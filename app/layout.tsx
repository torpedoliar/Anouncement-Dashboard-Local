import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
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
      <body
        className={`${inter.variable} ${montserrat.variable} font-sans bg-dark-primary text-light-primary antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
