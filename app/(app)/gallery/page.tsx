"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Trash2, Wand2, Check } from "lucide-react";
import { useHolder } from "@/components/holder-provider";
import {
  loadHistory,
  removeHistory,
  clearHistory,
  mergeHistory,
  type HistoryItem,
} from "@/lib/history";

export default function GalleryPage() {
  const { connected } = useHolder();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadHistory());
     
    setReady(true);
  }, []);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/history").then((x) => x.json());
        if (active && Array.isArray(r.items) && r.items.length) {
          setItems(mergeHistory(r.items));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [connected]);

  const remove = (id: string) => {
    setItems(removeHistory(id));
    if (connected) fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };
  const clearAll = () => {
    if (!confirm("Clear your whole gallery?")) return;
    setItems(clearHistory());
    if (connected) fetch("/api/history", { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">My Wizards</h1>
          <p className="text-sm text-mute">
            {items.length} generation{items.length === 1 ? "" : "s"} · newest first
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-full border border-line/70 px-3 py-1.5 text-xs text-mute transition-colors hover:border-red/40 hover:text-red"
          >
            <Trash2 className="size-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* storage warning */}
      {ready && (
        <div
          className={cnBanner(connected)}
        >
          {connected ? (
            <>
              <Check className="size-4 shrink-0 text-orange" />
              <p className="text-sm text-mute">
                <span className="text-ink">Synced to your wallet.</span> Your gallery is saved across
                devices.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 shrink-0 text-orange" />
              <p className="text-sm text-mute">
                <span className="text-ink">Heads up — these are only saved in this browser.</span>{" "}
                Clear it or switch devices and they&apos;re gone. Connect your wallet (top-right) to
                keep your gallery safe.
              </p>
            </>
          )}
        </div>
      )}

      {/* grid / empty */}
      {ready && items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line/70 py-16 text-center">
          <Wand2 className="size-8 text-faint" />
          <p className="text-mute">No wizards yet.</p>
          <Link
            href="/"
            className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-night transition-opacity hover:opacity-90"
          >
            Conjure your first
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Card key={it.id} item={it} onRemove={() => remove(it.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function cnBanner(connected: boolean) {
  return [
    "mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3",
    connected ? "border-orange/25 bg-orange/[0.06]" : "border-orange/30 bg-orange/[0.09]",
  ].join(" ");
}

function Card({ item, onRemove }: { item: HistoryItem; onRemove: () => void }) {
  const url = item.urls[0];
  const dl = `/api/proxy?url=${encodeURIComponent(url)}&download=${
    item.kind === "video" ? "wizardz.mp4" : "wizardz.png"
  }`;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-line/70 bg-night [content-visibility:auto] [contain-intrinsic-size:auto_220px]">
      {item.kind === "video" ? (
        <video src={url} autoPlay loop muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={item.prompt} loading="lazy" className="size-full object-cover" />
      )}

      {item.urls.length > 1 && (
        <span className="absolute left-2 top-2 rounded-full bg-night/75 px-1.5 py-0.5 font-mono text-[9px] text-ink backdrop-blur">
          ×{item.urls.length}
        </span>
      )}
      {item.mode === "gif" && (
        <span className="absolute right-2 top-2 rounded-full bg-night/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink backdrop-blur">
          GIF
        </span>
      )}

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-night/90 via-night/10 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-2 text-[11px] leading-snug text-mute">{item.prompt}</p>
        <div className="mt-2 flex gap-1.5">
          <a
            href={dl}
            target="_blank"
            rel="noreferrer"
            download
            title="Download"
            className="flex size-7 items-center justify-center rounded-lg bg-night/80 text-mute backdrop-blur transition-colors hover:text-ink"
          >
            <Download className="size-3.5" />
          </a>
          <button
            onClick={onRemove}
            title="Remove"
            className="flex size-7 items-center justify-center rounded-lg bg-night/80 text-mute backdrop-blur transition-colors hover:text-red"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
