import { describe, expect, it } from "vitest";
import { normalizePhone } from "./whatsapp";

describe("normalizePhone", () => {
  it("aceita formatos comuns do Brasil", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizePhone("+55 11 98765-4321")).toBe("5511987654321");
    expect(normalizePhone("1132654321")).toBe("551132654321");
  });
  it("recusa o que não é telefone", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
