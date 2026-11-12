import type { Metadata } from "next";
import { SavedList } from "./SavedList";

export const metadata: Metadata = { title: "Meus grupos" };

export default function MyGroups() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-pine">Meus grupos</h1>
        <p className="mt-1 text-muted">Os grupos que você abriu neste aparelho. Em outro celular ou navegador, eles não aparecem.</p>
      </div>
      <SavedList />
    </div>
  );
}
