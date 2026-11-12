import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { Logo } from "@/components/Logo";
import "./globals.css";

// Fontes salvas no repositório (subconjunto latino, licença OFL): o build não depende do Google Fonts.
const atkinson = localFont({
  src: "./fonts/atkinson-hyperlegible-next.woff2", weight: "200 800", variable: "--font-atkinson", display: "swap", adjustFontFallback: false,
});
const shantell = localFont({
  src: "./fonts/shantell-sans.woff2", weight: "300 800", variable: "--font-shantell", display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Amigo Secreto: organize o sorteio pelo celular", template: "%s · Amigo Secreto" },
  description: "Crie o grupo, mande o convite pelo WhatsApp e faça o sorteio. Cada pessoa vê só quem tirou, sem precisar criar conta.",
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0f4d3a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${atkinson.variable} ${shantell.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-sheet focus:px-4 focus:py-2">
          Pular para o conteúdo
        </a>
        <header className="border-b border-line/70">
          <nav aria-label="Principal" className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 rounded-md text-base font-bold text-pine sm:text-lg">
              <Logo className="h-8 w-8 shrink-0" />
              <span className="whitespace-nowrap max-[359px]:sr-only">Amigo Secreto</span>
            </Link>
            <div className="flex items-center text-[0.95rem] font-semibold">
              <Link href="/meus-grupos" className="whitespace-nowrap rounded-full px-2.5 py-2 text-pine hover:bg-pine-soft sm:px-3">Meus grupos</Link>
              <Link href="/duvidas" className="whitespace-nowrap rounded-full px-2.5 py-2 text-pine hover:bg-pine-soft sm:px-3">Dúvidas</Link>
            </div>
          </nav>
        </header>
        <main id="conteudo" className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line/70">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Gratuito. Sem anúncios. Sem precisar criar conta.</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li><Link className="hover:text-pine hover:underline" href="/duvidas#privacidade">Privacidade</Link></li>
              <li><Link className="hover:text-pine hover:underline" href="/recuperar">Perdi meu link</Link></li>
              <li><Link className="hover:text-pine hover:underline" href="/duvidas">Dúvidas frequentes</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
