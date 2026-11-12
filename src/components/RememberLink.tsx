"use client";

import { useEffect } from "react";
import { saveLink, type SavedLink } from "@/lib/saved";

/** Guarda o link aberto neste aparelho, para aparecer em "Meus grupos". */
export function RememberLink(props: Omit<SavedLink, "savedAt">) {
  const { kind, token, group, person } = props;
  useEffect(() => saveLink({ kind, token, group, person }), [kind, token, group, person]);
  return null;
}
