import type { Metadata } from "next";
import { Inter, Montserrat, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

// Masthead / display / headings — the newsroom voice (spec §3.2)
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700"],
});

// Numbers / IDs / clocks / counts / timestamps (spec §3.2)
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
      <body
        className={`${inter.variable} ${montserrat.variable} ${sora.variable} ${mono.variable} font-sans antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
