import { describe, expect, it } from "vitest";
import { parseInviteInput } from "./links";

const SITE = "https://amigo-secreto.anselmotech.com.br";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("parseInviteInput", () => {
  it("aceita o link do convite com espaços em volta", () => {
    expect(parseInviteInput(`  ${SITE}/g/abc123XYZ \n`)).toEqual({ ok: true, kind: "invite", path: "/g/abc123XYZ" });
  });

  it("acha o link no meio da mensagem do WhatsApp", () => {
    const msg = `🎁 Amigo secreto "Família"!\n📅 24/12/2026\n\nEntre no grupo pelo link e escreva seu nome: ${SITE}/g/abc123XYZ`;
    expect(parseInviteInput(msg)).toMatchObject({ ok: true, path: "/g/abc123XYZ" });
  });

  it("não junta o texto seguinte ao link pessoal", () => {
    const msg = `Este link é só seu (não repasse): ${SITE}/p/${TOKEN}\nPor ele você confirma presença`;
    expect(parseInviteInput(msg)).toEqual({ ok: true, kind: "participant", path: `/p/${TOKEN}` });
  });

  it("tira espaços acidentais no meio do link ou do código", () => {
    expect(parseInviteInput(`${SITE}/g/abc123 XYZ`)).toMatchObject({ ok: true, path: "/g/abc123XYZ" });
    expect(parseInviteInput(`${SITE}/g/ abc123 XYZ`)).toMatchObject({ ok: true, path: "/g/abc123XYZ" });
    expect(parseInviteInput("abc 123 XYZ")).toEqual({ ok: true, kind: "invite", path: "/g/abc123XYZ" });
  });

  it("aceita link sem https e link do painel", () => {
    expect(parseInviteInput(`amigo-secreto.anselmotech.com.br/o/${TOKEN}`)).toEqual({ ok: true, kind: "admin", path: `/o/${TOKEN}` });
  });

  it("aceita o endereço aberto agora (desenvolvimento)", () => {
    expect(parseInviteInput(`http://localhost:3000/g/abc123XYZ`, "localhost:3000")).toMatchObject({ ok: true });
  });

  it("recusa links de outros sites, mesmo com caminho parecido", () => {
    for (const bad of [`https://evil.com/g/abc123XYZ`, `https://amigo-secreto.anselmotech.com.br.evil.com/p/${TOKEN}`, `//evil.com/g/abc123`]) {
      const r = parseInviteInput(bad);
      expect(r.ok).toBe(false);
    }
  });

  it("recusa links pessoais curtos demais e lixo", () => {
    expect(parseInviteInput(`${SITE}/p/curto`).ok).toBe(false);
    expect(parseInviteInput("javascript:alert(1)").ok).toBe(false);
    expect(parseInviteInput("oi").ok).toBe(false);
    expect(parseInviteInput("   ")).toEqual({ ok: false, error: "Cole o link ou o código que você recebeu." });
  });

  it("só devolve caminhos internos", () => {
    const inputs = [`${SITE}/g/abc123XYZ`, `/p/${TOKEN}`, "abc123XYZ", `${SITE}/o/${TOKEN}?x=https://evil.com`];
    for (const i of inputs) {
      const r = parseInviteInput(i);
      if (r.ok) expect(r.path).toMatch(/^\/[gpo]\/[A-Za-z0-9_-]+$/);
    }
  });
});
