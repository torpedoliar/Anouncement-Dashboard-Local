"use client";

// Client reference untuk ikon Phosphor yang dipakai dari server components.
// @phosphor-icons/react mengeksekusi `createContext` di module scope; saat
// di-resolve lewat kondisi react-server (entry react.react-server.js tanpa
// createContext), import langsung dari server module crash. Re-export lewat
// modul "use client" membuat server hanya menerima client referencendle.
export {
  Files,
  Eye,
  PencilSimple,
  Broadcast,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react";