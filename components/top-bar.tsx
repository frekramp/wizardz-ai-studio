"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Wallet, Check } from "lucide-react";
import { UNISAT, XVERSE, MAGIC_EDEN, LEATHER, OKX, PHANTOM } from "@omnisat/lasereyes-react";
import { cn } from "@/lib/utils";
import { useHolder } from "@/components/holder-provider";

const TITLES: Record<string, string> = {
  "/": "AI Studio",
  "/gallery": "My Wizards",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
  "/faq": "FAQ",
  "/about": "About",
};

const WALLETS: { id: string; name: string }[] = [
  { id: UNISAT, name: "UniSat" },
  { id: XVERSE, name: "Xverse" },
  { id: MAGIC_EDEN, name: "Magic Eden" },
  { id: LEATHER, name: "Leather" },
  { id: OKX, name: "OKX" },
  { id: PHANTOM, name: "Phantom" },
];

function truncate(a: string) {
  return a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-4)}` : a;
}

function ConnectWallet() {
  const { connected, holder, address, loading, error, connectWallet, disconnect } = useHolder();
  const [open, setOpen] = useState(false);

  if (connected && address) {
    return (
      <button
        onClick={disconnect}
        title="Disconnect"
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-ink",
          holder ? "border-orange/40 bg-orange/10" : "border-line bg-card/60",
        )}
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full",
            holder ? "bg-orange/20 text-orange" : "bg-card-2 text-mute",
          )}
        >
          <Check className="size-3" />
        </span>
        <span className="font-mono text-xs">{truncate(address)}</span>
        {holder && (
          <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-orange">
            Holder
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-night transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Wallet className="size-4" />
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-2xl">
            <p className="px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Choose a wallet
            </p>
            {WALLETS.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setOpen(false);
                  void connectWallet(w.id);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-mute transition-colors hover:bg-night/60 hover:text-ink"
              >
                <span>{w.name}</span>
                <Wallet className="size-3.5 text-faint" />
              </button>
            ))}
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] leading-snug text-faint">
              You&apos;ll sign a message to prove ownership — no transaction, no gas.
            </p>
          </div>
        </>
      )}

      {error && !open && (
        <p className="absolute right-0 mt-1 w-max max-w-[15rem] text-right text-[11px] text-red">
          {error}
        </p>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "AI Studio";
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line/60 bg-night/80 px-5 backdrop-blur-xl sm:px-7">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          alt="Wizardz"
          className="size-7 rounded-md lg:hidden"
        />
        <span className="font-display text-base tracking-tight text-ink lg:hidden">
          Wizardz
        </span>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-faint lg:inline">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <ConnectWallet />
      </div>
    </header>
  );
}
