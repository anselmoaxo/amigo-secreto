"use client";

import { useState } from "react";
import { markSeen } from "@/app/actions";

export function Reveal({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <button
      className="btn w-full py-4 text-lg"
      onClick={() => {
        setOpen(true);
        void markSeen(groupId);
      }}
    >
      🎁 Ver quem eu tirei
    </button>
  );
}
