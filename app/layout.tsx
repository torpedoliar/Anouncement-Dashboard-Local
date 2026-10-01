import type { Metadata } from "next";
import { Libre_Franklin, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme-key";
// UI & body — turunan Franklin Gothic, tradisi tipografi surat kabar.
const sans = Libre_Franklin({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Serif editorial — judul, masthead, isi artikel. Axis opsz: huruf menyesuaikan ukuran.
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

// Angka / ID / jam / hitungan / timestamp.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Dashboard Pengumuman | Santos Jaya Abadi",
  description: "Portal pengumuman dan berita terbaru dari Santos Jaya Abadi",
  keywords: ["pengumuman", "berita", "santos jaya abadi", "kapal api"],
  authors: [{ name: "Santos Jaya Abadi" }],
  openGraph: {
    title: "Dashboard Pengumuman | Santos Jaya Abadi",
    description: "Portal pengumuman dan berita terbaru dari Santos Jaya Abadi",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      {/*
        JANGAN pasang `bg-dark-primary text-light-primary` di sini.
        Keduanya utilitas hex statis (#0A0A0A / #FFFFFF) dengan spesifisitas
        kelas, jadi menang atas `body { background-color: var(--surface-0) }` di
        globals.css. Efeknya tema terang (`html.theme-light`) tidak pernah
        kelihatan: surface ikut terang tapi body tetap hitam dan teks tetap
        putih. Warna body sekarang murni dari token.
      */}
      {/* Tema per permukaan (lib/theme-key.ts) — diterapkan sebelum paint pertama */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }} />
      </head>
      <body
        className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
