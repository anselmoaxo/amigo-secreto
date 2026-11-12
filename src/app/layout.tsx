import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amigo Secreto",
  description: "Organize seu amigo secreto em minutos: convite por WhatsApp, sorteio justo e lista de desejos.",
};

export const viewport: Viewport = { themeColor: "#b91c1c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="bg-red-700 text-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold">🎁 Amigo Secreto</Link>
            <Link href="/grupos" className="text-sm underline-offset-4 hover:underline">Meus grupos</Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
