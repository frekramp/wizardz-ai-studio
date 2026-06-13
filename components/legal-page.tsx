import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-faint transition-colors hover:text-orange"
      >
        <ArrowLeft className="size-3.5" />
        Back to the Studio
      </Link>

      <h1 className="mt-5 font-display text-3xl text-ink sm:text-4xl">{title}</h1>
      {updated && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Last updated · {updated}
        </p>
      )}
      <div className="mt-4 rounded-lg border border-orange/25 bg-orange/[0.06] px-3.5 py-2.5 text-xs text-mute">
        Starting template — have it reviewed &amp; customized by a professional
        before launch. Not legal advice.
      </div>

      <div className="mt-8">{children}</div>
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-9 font-display text-xl text-ink first:mt-0">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[15px] leading-relaxed text-mute">{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-mute marker:text-orange">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
