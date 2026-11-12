import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Política de conteúdo: só recursos do próprio site. Nenhum script de terceiros
 * roda nas páginas com links privados (/o, /p). 'unsafe-inline' em script-src é exigido
 * pelos scripts de hidratação do Next sem nonce; como não carregamos nada de fora,
 * o ganho principal (bloquear scripts e conexões externas) continua valendo.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const security = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Os links privados têm o token no caminho: nada de Referer para sites externos (lojas da lista de desejos etc.).
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

/** Páginas com dados privados: nunca em cache compartilhado (CDN, proxy) nem no histórico de cache do navegador. */
const noStore = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Maior payload legítimo: criar grupo com 200 pessoas (~100 KB).
    serverActions: { bodySizeLimit: "300kb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      ...["/o/:path*", "/p/:path*", "/g/:path*", "/recuperar", "/meus-grupos"].map((source) => ({ source, headers: noStore })),
    ];
  },
};

export default nextConfig;
