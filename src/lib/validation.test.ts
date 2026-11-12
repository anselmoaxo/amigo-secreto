import { describe, expect, it } from "vitest";
import { CONTACT_REQUIRED, emptyGroup, validateContact, validateGroup, validatePerson } from "./validation";

const person = (email = "", phone = "") => ({ name: "Bia", email, phone, team: "" });
const group = (o: Partial<typeof emptyGroup>) => ({ ...emptyGroup, name: "Família", organizerName: "Ana", ...o });

describe("e-mail ou WhatsApp obrigatório", () => {
  it("participante sem nenhum contato é recusado nos dois campos", () => {
    expect(validatePerson(person())).toMatchObject({ email: CONTACT_REQUIRED, phone: CONTACT_REQUIRED });
  });

  it("participante com só e-mail ou só WhatsApp passa", () => {
    expect(validatePerson(person("bia@exemplo.test"))).toEqual({});
    expect(validatePerson(person("", "(11) 98765-4321"))).toEqual({});
  });

  it("contato inválido continua com a mensagem própria", () => {
    expect(validatePerson(person("bia@", ""))).toMatchObject({ email: "Confira o e-mail." });
    expect(validatePerson(person("", "123"))).toMatchObject({ phone: "Use DDD + número." });
  });

  it("espaços não contam como contato", () => {
    expect(validatePerson(person("   ", "  "))).toMatchObject({ email: CONTACT_REQUIRED });
    expect(validateContact(" ", " ")).toMatchObject({ email: CONTACT_REQUIRED, phone: CONTACT_REQUIRED });
  });

  it("organizador que participa pode dar só o WhatsApp", () => {
    expect(validateGroup(group({ organizerJoins: true, organizerPhone: "(11) 98765-4321" }))).toEqual({});
    expect(validateGroup(group({ organizerJoins: true }))).toMatchObject({ organizerEmail: CONTACT_REQUIRED, organizerPhone: CONTACT_REQUIRED });
  });

  it("organizador que só organiza precisa de e-mail (o WhatsApp não é guardado)", () => {
    const e = validateGroup(group({ organizerJoins: false, organizerPhone: "(11) 98765-4321" }));
    expect(e.organizerEmail).toMatch(/Informe seu e-mail/);
    expect(validateGroup(group({ organizerJoins: false, organizerEmail: "ana@exemplo.test" }))).toEqual({});
  });
});
