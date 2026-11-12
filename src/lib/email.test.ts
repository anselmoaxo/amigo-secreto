import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

describe("sendEmail", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; });

  it("devolve false quando o Resend recusa", async () => {
    process.env.RESEND_API_KEY = "x";
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"statusCode":403}', { status: 403 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail("a@x.com", "t", "h")).toBe(false);
  });

  it("devolve false quando a rede falha", async () => {
    process.env.RESEND_API_KEY = "x";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail("a@x.com", "t", "h")).toBe(false);
  });

  it("devolve true quando envia", async () => {
    process.env.RESEND_API_KEY = "x";
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"id":"1"}', { status: 200 })));
    expect(await sendEmail("a@x.com", "t", "h")).toBe(true);
  });
});

describe("emailLayout", () => {
  it("usa o banner e escapa o preheader", async () => {
    const { emailLayout, emailButton } = await import("./email");
    const html = emailLayout({ preheader: "<oi>", body: emailButton("https://x.com/p/abc", "Abrir") });
    expect(html).toContain("/email/banner.jpg");
    expect(html).toContain("&lt;oi&gt;");
    expect(html).toContain('href="https://x.com/p/abc"');
  });
});
