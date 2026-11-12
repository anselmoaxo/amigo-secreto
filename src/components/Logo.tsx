/** Papelzinho dobrado com a ponta dourada. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M5 9.5 25.5 6l2 15.5L7 25z" fill="#0f4d3a" />
      <path d="M7 25 27.5 21.5l-1.2-9.3L6 15.6z" fill="#18674f" />
      <path d="M22 6.6 25.5 6l.8 6.2z" fill="#e9b44c" />
      <path d="M10.5 12.7c3-.6 6.6-1.2 9.6-1.7" stroke="#fffdf6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
