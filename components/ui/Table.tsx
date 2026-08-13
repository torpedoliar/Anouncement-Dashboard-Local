"use client";

import { CaretUp, CaretDown } from "@phosphor-icons/react";

export interface TableColumn {
  key: string;
  header: React.ReactNode;
  sortKey?: string;
}

interface TableProps {
  columns: TableColumn[];
  rows: React.ReactNode[][];
  sort?: { key?: string; dir?: "asc" | "desc" };
  onSort?: (key: string) => void;
  ariaLabel?: string;
}

export default function Table({ columns, rows, sort, onSort, ariaLabel }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isSorted = sort?.key === col.sortKey;
              const isSortable = !!col.sortKey && !!onSort;
              return (
                <th
                  key={col.key}
                  aria-sort={isSorted ? (sort?.dir === "asc" ? "ascending" : "descending") : "none"}
                  className="px-4 py-3 text-left text-xs font-medium text-text-3"
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-text-1"
                    >
                      {col.header}
                      {isSorted ? (
                        sort?.dir === "asc" ? (
                          <CaretUp size={12} />
                        ) : (
                          <CaretDown size={12} />
                        )
                      ) : null}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-text-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}