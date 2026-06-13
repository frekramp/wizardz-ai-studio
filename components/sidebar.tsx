"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wand2,
  LayoutGrid,
  Sticker,
  MoreHorizontal,
  ChevronDown,
  Shield,
  FileText,
  HelpCircle,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN = [
  { label: "AI Studio", icon: Wand2, href: "/" },
  { label: "My Wizards", icon: LayoutGrid, href: "/gallery" },
  { label: "Stickers", icon: Sticker, href: null, soon: true },
] as const;

const MORE_LINKS = [
  { label: "Privacy Policy", icon: Shield, href: "/privacy" },
  { label: "Terms of Service", icon: FileText, href: "/terms" },
  { label: "FAQ", icon: HelpCircle, href: "/faq" },
  { label: "About", icon: Info, href: "/about" },
] as const;

const SOCIALS = [
  { label: "X (@wizardzBTC)", href: "https://x.com/wizardzBTC" },
  { label: "Satflow", href: "https://www.satflow.com/ordinals/wizardz" },
  { label: "wizardz.art", href: "https://wizardz.art" },
];

export function Sidebar() {
  const pathname = usePathname();
  const moreActive = MORE_LINKS.some((l) => l.href === pathname);
  const [moreOpen, setMoreOpen] = useState(moreActive);

  return (
    <aside className="sticky top-0 hidden h-svh w-[236px] shrink-0 flex-col border-r border-line/70 bg-panel/80 px-3 py-5 backdrop-blur-xl lg:flex">
      {/* brand */}
      <Link href="/" className="flex items-center gap-2.5 px-3 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Wizardz" className="size-8 rounded-lg" />
        <span className="font-display text-lg tracking-tight text-ink">Wizardz</span>
      </Link>

      {/* main nav */}
      <nav className="flex flex-col gap-1">
        {MAIN.map((item) => {
          const active = item.href !== null && pathname === item.href;
          const inner = (
            <>
              <item.icon
                className={cn(
                  "size-[18px] transition-colors",
                  active ? "text-orange" : "text-faint group-hover:text-mute",
                )}
              />
              {item.label}
              {"soon" in item && item.soon && (
                <span className="ml-auto rounded-full bg-card-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-faint">
                  Soon
                </span>
              )}
            </>
          );
          const base =
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors";
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={cn(base, active ? "bg-card text-ink" : "text-mute hover:bg-card/60 hover:text-ink")}
            >
              {inner}
            </Link>
          ) : (
            <div key={item.label} className={cn(base, "cursor-default text-faint")}>
              {inner}
            </div>
          );
        })}

        {/* More (expandable) */}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            moreActive ? "text-ink" : "text-mute hover:bg-card/60 hover:text-ink",
          )}
        >
          <MoreHorizontal
            className={cn(
              "size-[18px] transition-colors",
              moreActive ? "text-orange" : "text-faint group-hover:text-mute",
            )}
          />
          More
          <ChevronDown
            className={cn(
              "ml-auto size-4 text-faint transition-transform",
              moreOpen && "rotate-180",
            )}
          />
        </button>

        {moreOpen && (
          <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-line/70 pl-3">
            {MORE_LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                    active ? "bg-card text-ink" : "text-mute hover:text-ink",
                  )}
                >
                  <l.icon className={cn("size-4", active ? "text-orange" : "text-faint")} />
                  {l.label}
                </Link>
              );
            })}
            <div className="my-1 h-px bg-line/60" />
            {SOCIALS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-mute transition-colors hover:text-ink"
              >
                {s.label}
                <ArrowUpRight className="ml-auto size-3.5 text-faint" />
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* footer card */}
      <div className="mt-auto rounded-xl border border-line/60 bg-card/50 p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Collection
          </span>
          <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-medium text-orange">
            Sold out
          </span>
        </div>
        <p className="mt-2 font-display text-2xl text-ink">333</p>
        <p className="text-xs text-faint">animated wizards · forever</p>
      </div>
    </aside>
  );
}
