"use client";

import { ArrowsDownUp, CaretDown, CaretUp } from "@phosphor-icons/react";

export interface TableColumn {
  key: string;
  header: React.ReactNode;
  sortKey?: string;
  /** Ratakan kanan untuk kolom angka. */
  align?: "left" | "right";
  /** Sembunyikan di layar sempit ketika kolom ini bukan yang utama. */
  hideBelow?: "sm" | "md" | "lg";
}

interface TableProps {
  columns: TableColumn[];
  rows: React.ReactNode[][];
  sort?: { key?: string; dir?: "asc" | "desc" };
  onSort?: (key: string) => void;
  ariaLabel?: string;
  /** Ditampilkan saat `rows` kosong. Tanpa ini tabel hanya menyisakan header. */
  emptyState?: React.ReactNode;
  /** Header menempel saat isi tabel di-scroll. */
  stickyHeader?: boolean;
}

const HIDE_BELOW: Record<NonNullable<TableColumn["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export default function Table({
  columns,
  rows,
  sort,
  onSort,
  ariaLabel,
  emptyState,
  stickyHeader = false,
}: TableProps) {
  if (rows.length === 0 && emptyState) {
    return <div className="px-4 py-12 text-center">{emptyState}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isSortable = !!col.sortKey && !!onSort;
              const isSorted = isSortable && sort?.key === col.sortKey;
              const alignClass = col.align === "right" ? "text-right" : "text-left";
              const hideClass = col.hideBelow ? HIDE_BELOW[col.hideBelow] : "";

              return (
                <th
                  key={col.key}
                  scope="col"
                  // aria-sort hanya sah pada header yang memang bisa diurutkan.
                  // Sebelumnya setiap header mendapat aria-sort="none", termasuk
                  // kolom statis, sehingga screen reader mengumumkan kolom yang
                  // tidak bisa diurutkan sebagai bisa diurutkan.
                  aria-sort={
                    isSortable
                      ? isSorted
                        ? sort?.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={`whitespace-nowrap bg-surface-1 px-4 py-3 text-xs font-medium text-text-3 ${alignClass} ${hideClass} ${
                    stickyHeader ? "sticky top-0 z-dropdown" : ""
                  }`}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.sortKey!)}
                      className={`group inline-flex cursor-pointer items-center gap-1 rounded-control transition-colors duration-150 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        isSorted ? "text-text-1" : ""
                      }`}
                    >
                      {col.header}
                      {/* Ikon netral saat belum diurutkan: tanpa ini tidak ada
                          petunjuk visual bahwa kolom bisa diklik. */}
                      {isSorted ? (
                        sort?.dir === "asc" ? (
                          <CaretUp size={12} weight="bold" aria-hidden="true" />
                        ) : (
                          <CaretDown size={12} weight="bold" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowsDownUp
                          size={12}
                          aria-hidden="true"
                          className="opacity-0 transition-opacity duration-150 group-hover:opacity-60 group-focus-visible:opacity-60"
                        />
                      )}
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
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-2/60"
            >
              {row.map((cell, cellIndex) => {
                const col = columns[cellIndex];
                const alignClass = col?.align === "right" ? "text-right" : "text-left";
                const hideClass = col?.hideBelow ? HIDE_BELOW[col.hideBelow] : "";
                return (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-text-1 ${alignClass} ${hideClass}`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
