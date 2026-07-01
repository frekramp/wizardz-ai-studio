"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Image as ImageIcon,
  Film,
  Sparkles,
  Download,
  Share2,
  RotateCcw,
  Lock,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Upload,
  Hash,
  X,
  Dices,
  Laugh,
  Type,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardArt } from "@/components/wizard-placeholder";
import { useHolder } from "@/components/holder-provider";
import { addHistory } from "@/lib/history";
import {
  MEME_PRESETS,
  MEME_MAX_CAPTION,
  findMemePreset,
  type MemePreset,
  type CaptionPosition,
} from "@/lib/memes";
import { EYE_KEYS, EYE_LABELS, type EyeKey } from "@/lib/eyes";

type Mode = "image" | "gif" | "recreate" | "wiz" | "meme";
type Phase = "idle" | "loading" | "result";
type Result = { urls: string[]; kind: "image" | "video" } | null;

// The collection is exactly 333. The server re-validates against the built index.
const WIZ_MAX = 333;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Diagonal tiled teaser watermark (public only), drawn as a repeating SVG pattern.
const WATERMARK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='210' height='120'><text x='105' y='64' text-anchor='middle' transform='rotate(-24 105 64)' font-family='Arial, Helvetica, sans-serif' font-size='13' font-weight='700' fill='white'>✦ wizardz.art</text></svg>",
)}")`;

// Preload the generated asset so the loader doesn't vanish before it's on screen.
function preload(url: string, kind: "image" | "video"): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 9000); // safety: never hang the UI
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    if (kind === "video") {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.onloadeddata = finish;
      v.onerror = finish;
      v.src = url;
    } else {
      const img = new window.Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
    }
  });
}

const LOADING_PHRASES = [
  "Channeling the arcane…",
  "Stoking the fire…",
  "Summoning pixels…",
  "Consulting the moon…",
  "Etching the sigils…",
];

const CHIPS: Record<Mode, string[]> = {
  image: [
    "a wise wizard with a glowing staff",
    "floating in a starry galaxy",
    "potion-brewing trickster wizard",
    "casting a fireball under a blood moon",
  ],
  gif: [
    "wizard casting a fire spell, looping",
    "wizard sipping a bubbling potion",
    "wizard winking — sticker style",
    "wizard dancing under the moon",
  ],
  recreate: [
    "keep the original colors",
    "make it more epic",
    "neon cyberpunk lighting",
    "golden hour glow",
  ],
  wiz: [
    "in a spaceship cockpit casting fire",
    "riding a cosmic surfboard",
    "holding a glowing bitcoin",
    "epic hero portrait, nebula behind",
  ],
  meme: [], // meme mode uses the preset buttons instead of generic chips
};

const MOTIONS = ["Float", "Bounce", "Spin", "Pulse"];

function castConfetti() {
  const fire = (ratio: number, opts: confetti.Options) =>
    confetti({
      origin: { y: 0.4 },
      colors: ["#ffc21e", "#ff7a18", "#ea3b23", "#ffffff"],
      disableForReducedMotion: true,
      ...opts,
      particleCount: Math.floor(170 * ratio),
    });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.85 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
}

export function AiStudio() {
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [phrase, setPhrase] = useState(0);
  const [seed, setSeed] = useState(1);
  const [result, setResult] = useState<Result>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [usage, setUsage] = useState<{ image: number; gif: number }>({ image: 0, gif: 0 });
  const [limits, setLimits] = useState<{ image: number | null; gif: number }>({ image: 10, gif: 1 });
  const [resultMode, setResultMode] = useState<Mode>("image");
  const [motionKind, setMotionKind] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [wizNum, setWizNum] = useState("");
  const [caption, setCaption] = useState("");
  const [captionPos, setCaptionPos] = useState<CaptionPosition>("bottom");
  const [memeTag, setMemeTag] = useState("");
  const [eyeSel, setEyeSel] = useState<EyeKey | "">(""); // "" = auto (parse the prompt)
  const [dragOver, setDragOver] = useState(false);
  const [wizPreview, setWizPreview] = useState<{
    n: number;
    imageUrl: string;
    traits: string | null;
  } | null>(null);
  const [wizSet, setWizSet] = useState<Set<number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const genRef = useRef(0);
  const { holder } = useHolder();

  const isGif = mode === "gif";
  const modeLimit = isGif ? limits.gif : limits.image; // null = unlimited
  const modeUsed = isGif ? usage.gif : usage.image;
  const remaining = modeLimit == null ? null : Math.max(0, modeLimit - modeUsed);
  const capped = remaining === 0;
  const needed = 1; // one image (or one GIF) per generation
  const overQuota = remaining != null && needed > remaining;
  const wizValue = Number(wizNum);
  const wizValid = Number.isInteger(wizValue) && wizValue >= 1 && wizValue <= WIZ_MAX;
  const wizMinted = !wizSet || wizSet.has(wizValue); // 3 numbers are unminted gaps
  // Meme is ready with a typed/clicked scene OR a bare preset tag (e.g. "gm") the server expands.
  const memeReady = prompt.trim().length >= 2 || !!findMemePreset(prompt.trim());
  const hasInput =
    mode === "recreate"
      ? !!uploadFile
      : mode === "wiz"
        ? wizValid && wizMinted
        : mode === "meme"
          ? memeReady
          : prompt.trim().length > 2;
  const applyPreset = (p: MemePreset) => {
    setPrompt(p.prompt);
    setCaption(p.caption);
    setCaptionPos(p.position);
    setMemeTag(p.tag);
    setError(null);
  };
  const canGenerate = phase !== "loading" && !uploading && hasInput && !overQuota;

  const onPickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Use a PNG, JPG, WEBP or GIF.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large (max 8 MB).");
      return;
    }
    setError(null);
    setUploadFile(f);
    setUploadPreview(URL.createObjectURL(f));
  };
  const clearUpload = () => {
    setUploadFile(null);
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await fetch("/api/usage").then((r) => r.json());
        if (!active) return;
         
        setUsage(u.usage ?? { image: 0, gif: 0 });
         
        setLimits(u.limits ?? { image: 10, gif: 1 });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [holder]);

  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(
      () => setPhrase((p) => (p + 1) % LOADING_PHRASES.length),
      720,
    );
    return () => clearInterval(id);
  }, [phase]);

  // Load the set of minted numbers once on mount — so the random button + gap validation are
  // ready before the user ever opens Wiz # (avoids a gap # being briefly clickable on first open).
  useEffect(() => {
    let active = true;
    fetch("/api/wiz")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.numbers)) setWizSet(new Set<number>(d.numbers));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Revoke the upload preview's object URL when it changes or on unmount (no memory leak).
  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  // Preview the wizard being summoned (its on-chain art + traits), debounced. The preview is
  // tagged with its number so the JSX can ignore a stale fetch for a different #.
  useEffect(() => {
    if (mode !== "wiz" || !wizValid) return;
    let active = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/wiz?n=${wizValue}`).then((res) => res.json());
        if (active)
          setWizPreview(
            r?.ok ? { n: wizValue, imageUrl: r.imageUrl, traits: r.traits ?? null } : null,
          );
      } catch {
        /* keep any prior preview; the JSX gates on a matching number */
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [mode, wizValue, wizValid]);

  const generate = async () => {
    if (!canGenerate) return;
    const myGen = ++genRef.current;
    const usedMode = mode;
    // A readable label for the gallery (recreate/wiz don't lead with a text prompt).
    const usedPrompt =
      usedMode === "wiz"
        ? `Wizard #${wizValue}${prompt.trim() ? " — " + prompt.trim() : ""}`
        : usedMode === "recreate"
          ? prompt.trim() || "Recreated image"
          : usedMode === "meme"
            ? caption.trim()
              ? `"${caption.trim()}" meme`
              : prompt.trim() || "Meme"
            : prompt.trim();
    setResultMode(mode);
    setResult(null);
    setActiveIdx(0);
    setError(null);
    setSeed((s) => s + 1);
    setPhase("loading");

    try {
      // Recreate: park the uploaded image on fal.storage first, then condition on its URL.
      let imageUrl: string | undefined;
      if (usedMode === "recreate") {
        if (!uploadFile) throw new Error("Upload an image first.");
        setUploading(true);
        const fd = new FormData();
        fd.append("file", uploadFile);
        const ures = await fetch("/api/upload", { method: "POST", body: fd });
        const udata = await ures.json();
        if (genRef.current !== myGen) return; // guard before touching shared state (gen-scoped)
        setUploading(false);
        if (!ures.ok || !udata.url) throw new Error(udata.error || "Upload failed.");
        imageUrl = udata.url as string;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: usedMode,
          prompt,
          motion: MOTIONS[motionKind],
          imageUrl,
          wiz: usedMode === "wiz" ? wizValue : undefined,
          memeTag: usedMode === "meme" ? memeTag : undefined,
          caption: usedMode === "meme" ? caption : undefined,
          captionPos: usedMode === "meme" ? captionPos : undefined,
          eyes: usedMode === "image" ? eyeSel || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (genRef.current !== myGen) return;

      if (data.usage) setUsage(data.usage);
      if (data.limits) setLimits(data.limits);

      // No key configured → mock placeholder result.
      if (data.mock) {
        await sleep(1800);
        if (genRef.current !== myGen) return;
        setResult(null);
        setPhase("result");
        castConfetti();
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed.");

      // Synchronous engine (OpenAI gpt-image-2) returns the result directly — no requestId/poll.
      if (data.urls && data.kind) {
        const urls: string[] = data.urls;
        if (!urls.length) throw new Error("No output returned.");
        await preload(urls[0], data.kind);
        if (genRef.current !== myGen) return;
        setResult({ urls, kind: data.kind });
        setActiveIdx(0);
        setPhase("result");
        castConfetti();
        // Inline data URLs are too large to persist server-side / reliably in localStorage;
        // gallery sync returns once images are hosted (R2). Skip history for data URLs.
        if (!urls[0].startsWith("data:")) {
          const saved = addHistory({ urls, kind: data.kind, prompt: usedPrompt, mode: usedMode });
          fetch("/api/history", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(saved),
          }).catch(() => {});
        }
        return;
      }

      // Poll the queue until the result is ready. `claim` proves we're the submitter so
      // /api/status will return the result (binds the job to us — see route).
      const { requestId, model, claim } = data;
      // GIF (Kling) jobs can take far longer than images — give them a bigger poll budget so a
      // slow-but-healthy job isn't surfaced as a false "timed out" (the credit was already spent).
      const maxPolls = usedMode === "gif" ? 200 : 100;
      for (let i = 0; i < maxPolls; i++) {
        await sleep(2000);
        if (genRef.current !== myGen) return;
        const sres = await fetch(
          `/api/status?requestId=${encodeURIComponent(requestId)}&model=${encodeURIComponent(model)}&claim=${encodeURIComponent(claim ?? "")}`,
        );
        const sdata = await sres.json();
        if (genRef.current !== myGen) return;
        if (sdata.error) throw new Error(sdata.error);
        if (sdata.status === "COMPLETED") {
          const urls: string[] = sdata.urls ?? [];
          if (!urls.length) throw new Error("No output returned.");
          // Keep the loader up until the media is actually decoded (no blank flash).
          await preload(urls[0], sdata.kind);
          if (genRef.current !== myGen) return;
          setResult({ urls, kind: sdata.kind });
          setActiveIdx(0);
          setPhase("result");
          castConfetti();
          // Save to the gallery (localStorage + server sync if connected).
          const saved = addHistory({ urls, kind: sdata.kind, prompt: usedPrompt, mode: usedMode });
          fetch("/api/history", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(saved),
          }).catch(() => {});
          return;
        }
      }
      throw new Error("Timed out — please try again.");
    } catch (e) {
      if (genRef.current !== myGen) return; // stale gen → don't clobber the active one's state
      setUploading(false);
      setError((e as Error).message || "Something went wrong.");
      setPhase("idle");
    }
  };

  const shareResult = async () => {
    const i = Math.min(activeIdx, (result?.urls.length ?? 1) - 1);
    const u = result?.urls?.[i];
    if (!u) return;
    const link = `${window.location.origin}/api/proxy?url=${encodeURIComponent(u)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Wizardz", text: "Made with Wizardz Studio", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setNotice("Link copied!");
        setTimeout(() => setNotice(null), 1600);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const downloadGif = async () => {
    if (!result?.urls?.length || converting) return;
    setConverting(true);
    setError(null);
    try {
      const { videoToGif, downloadBlob } = await import("@/lib/sticker");
      const blob = await videoToGif(result.urls[0]);
      downloadBlob(blob, "wizardz-sticker.gif");
    } catch (e) {
      setError("GIF export failed: " + ((e as Error).message || "try again"));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8">
      {/* brand banner hero (real X banner + logo) */}
      <div className="relative overflow-hidden rounded-[1.4rem] border border-line/70">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/banner.png"
          alt="Wizardz"
          className="h-44 w-full object-cover sm:h-52"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/75 to-night/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-night/95 via-night/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="" className="size-4 rounded" />
            Wizardz Spellbook
          </span>
          <h1 className="mt-2 text-balance text-3xl leading-[1.02] sm:text-4xl">
            Summon your <span className="text-gradient">wizard</span>.
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-mute sm:text-[15px]">
            Reimagine the 333 — conjure a wizard from a prompt, recreate any
            meme, or summon your wiz by number.
          </p>
        </div>
      </div>

      {/* preview canvas — square to match the 1:1 renders so the full image shows uncropped */}
      <div className="relative mt-5 grid aspect-square w-full place-items-center overflow-hidden rounded-[1.4rem] border border-line/70 bg-night/85">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 px-6 text-center"
            >
              <WizardArt className="size-24 rounded-2xl opacity-50" />
              <p className="max-w-[15rem] text-sm text-faint">
                Your {isGif ? "animated wizard" : "wizard"} will appear here.
              </p>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center"
            >
              <div className="absolute inset-0 shimmer" />
              <div className="relative flex flex-col items-center gap-4">
                <div className="relative grid size-16 place-items-center">
                  <span className="absolute inset-0 spin-slow rounded-full border border-dashed border-orange/50" />
                  <Sparkles className="size-7 text-orange" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phrase}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="font-display text-lg text-mute"
                  >
                    {LOADING_PHRASES[phrase]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative h-full aspect-square py-3"
            >
              <div className="relative h-full overflow-hidden rounded-2xl">
                <div className={cn("size-full", resultMode === "gif" && "wiz-float")}>
                  {result ? (
                    result.kind === "video" ? (
                      <video
                        src={result.urls[0]}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="size-full object-contain"
                      />
                    ) : result.urls.length > 1 ? (
                      <div className="grid size-full grid-cols-2 gap-1">
                        {result.urls.map((u, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveIdx(i)}
                            className={cn(
                              "relative overflow-hidden rounded-md transition",
                              activeIdx === i ? "ring-2 ring-orange" : "opacity-80 hover:opacity-100",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt={`Wizard ${i + 1}`} className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={result.urls[0]} alt="Your wizard" className="size-full object-contain" />
                    )
                  ) : (
                    <WizardArt className="size-full" seed={seed} />
                  )}
                </div>

                {/* GIF badge */}
                {resultMode === "gif" && (
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-night/75 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-ink backdrop-blur">
                    <span className="size-1.5 animate-pulse rounded-full bg-red" />
                    GIF · loop
                  </span>
                )}

                {/* variant picker hint — one tap gives several, holder picks the best */}
                {result && result.kind === "image" && result.urls.length > 1 && (
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-night/75 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-ink backdrop-blur">
                    <span className="size-1.5 rounded-full bg-orange" />
                    Tap to pick your favorite
                  </span>
                )}

                {/* watermark (public teaser only — holders get clean output) */}
                {!holder && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.22]"
                      style={{ backgroundImage: WATERMARK }}
                    />
                    <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-night/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mute backdrop-blur">
                      ✦ wizardz.art
                    </span>
                  </>
                )}

                <div className="absolute bottom-2.5 right-2.5 flex gap-1.5">
                  {result?.kind === "video" && (
                    <CanvasAction
                      icon={converting ? Loader2 : Film}
                      label={converting ? "Converting…" : "Save GIF"}
                      onClick={downloadGif}
                      spinning={converting}
                    />
                  )}
                  <CanvasAction
                    icon={Download}
                    label="Download"
                    href={
                      result?.urls?.length
                        ? `/api/proxy?url=${encodeURIComponent(
                            result.urls[Math.min(activeIdx, result.urls.length - 1)],
                          )}&download=${result.kind === "video" ? "wizardz.mp4" : "wizardz.png"}`
                        : undefined
                    }
                  />
                  <CanvasAction icon={Share2} label="Share" onClick={shareResult} />
                  <CanvasAction icon={RotateCcw} label="Again" onClick={() => setPhase("idle")} />
                </div>

                {notice && (
                  <div className="pointer-events-none absolute left-1/2 top-2.5 -translate-x-1/2 rounded-full bg-night/85 px-3 py-1 text-xs text-ink backdrop-blur">
                    {notice}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-red/30 bg-red/[0.08] px-4 py-3 text-sm text-ink">
              <AlertTriangle className="size-4 shrink-0 text-red" />
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* unlock strip (public, result only — holders are already unlocked) */}
      <AnimatePresence>
        {phase === "result" && !holder && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange/25 bg-orange/[0.07] px-4 py-3">
              <Lock className="size-4 shrink-0 text-orange" />
              <p className="text-sm text-mute">
                <span className="text-ink">
                  {resultMode === "gif"
                    ? "Lose the watermark & export sticker packs."
                    : "Lose the watermark & go unlimited."}
                </span>{" "}
                Own a Wizardz to unlock the full studio.
              </p>
              <a
                href="https://www.satflow.com/ordinals/wizardz"
                target="_blank"
                rel="noreferrer"
                className="ml-auto shrink-0 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-night transition-opacity hover:opacity-90"
              >
                Get one
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* steps */}
      <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-line/60 bg-panel/70 text-center">
        {[
          ["01", mode === "recreate" ? "Upload" : mode === "wiz" ? "Pick #" : mode === "meme" ? "Pick meme" : "Describe"],
          ["02", isGif ? "Animate" : "Generate"],
          ["03", "Share"],
        ].map(([n, label], i) => (
          <div key={n} className={cn("px-3 py-3", i < 2 && "border-r border-line/60")}>
            <span className="font-mono text-[10px] tracking-[0.18em] text-faint">
              STEP {n}
            </span>
            <p className="text-sm text-mute">{label}</p>
          </div>
        ))}
      </div>

      {/* input dock */}
      <div className="mt-4 rounded-2xl border border-line/70 bg-card/85 p-3.5 backdrop-blur sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
            <Sparkles className="size-3.5 text-orange" />
            Spellbook v1
          </span>
          <span
            title={holder ? "Holder allowance" : "Free daily allowance — own a Wizardz for more"}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
              capped ? "border-orange/40 bg-orange/10 text-orange" : "border-line/70 text-mute",
            )}
          >
            {remaining == null ? (
              <>
                <Sparkles className="size-3 text-orange" />
                Unlimited
              </>
            ) : (
              <>
                {capped && <Lock className="size-3" />}
                {remaining} {isGif ? "GIF" : "image"}
                {remaining === 1 ? "" : "s"} left
              </>
            )}
          </span>
        </div>

        {/* category tabs: Image | GIF | Recreate | Wiz # */}
        <div
          role="tablist"
          aria-label="Generation mode"
          className="mb-3 grid grid-cols-5 gap-1 rounded-full border border-line/60 bg-night/50 p-1"
        >
          {(
            [
              { id: "image", label: "Image", icon: ImageIcon },
              { id: "gif", label: "GIF", icon: Film },
              { id: "recreate", label: "Recreate", icon: Upload },
              { id: "meme", label: "Meme", icon: Laugh },
              { id: "wiz", label: "Wiz #", icon: Hash },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              title={t.label}
              aria-label={t.label}
              onClick={() => {
                setMode(t.id);
                setError(null);
                setNotice(null);
              }}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium transition-colors sm:px-2.5 sm:text-sm",
                mode === t.id ? "text-night" : "text-mute hover:text-ink",
              )}
            >
              {mode === t.id && (
                <motion.span
                  layoutId="dock-tab"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <t.icon className="relative size-4 shrink-0" />
              {/* labels hide on the smallest screens so five tabs fit; icons + tooltips remain */}
              <span className="relative hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* mode-specific input */}
        {mode === "recreate" ? (
          <div className="space-y-2.5">
            {uploadPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-line bg-night/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadPreview}
                  alt="Upload preview"
                  className="max-h-56 w-full object-contain"
                />
                <button
                  onClick={clearUpload}
                  aria-label="Remove image"
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-night/80 text-mute backdrop-blur transition-colors hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onPickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
                  dragOver
                    ? "border-orange/60 bg-orange/[0.06]"
                    : "border-line bg-night/40 hover:border-orange/40",
                )}
              >
                <Upload className="size-6 text-faint" />
                <span className="text-sm text-mute">
                  Drop a meme or photo, or <span className="text-ink">browse</span>
                </span>
                <span className="text-xs text-faint">PNG · JPG · WEBP · GIF — up to 8 MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Optional: extra direction (e.g. keep the colors, make it epic)…"
              className="ring-focus w-full resize-none rounded-xl border border-line bg-night/40 p-3.5 text-ink placeholder:text-faint focus:border-orange/50"
            />
          </div>
        ) : mode === "wiz" ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-night/40">
                {wizValid && wizPreview?.n === wizValue ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wizPreview.imageUrl}
                    alt={`Wizard #${wizValue}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-faint">
                    <Hash className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-line bg-night/40 px-3">
                    <span className="font-mono text-mute">#</span>
                    <input
                      type="number"
                      min={1}
                      max={WIZ_MAX}
                      value={wizNum}
                      onChange={(e) => setWizNum(e.target.value)}
                      placeholder="123"
                      aria-label="Wizard number"
                      className="ring-focus w-24 bg-transparent py-2.5 pl-1 text-ink placeholder:text-faint focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pool = wizSet ? [...wizSet] : null;
                      setWizNum(
                        String(
                          pool && pool.length
                            ? pool[Math.floor(Math.random() * pool.length)]
                            : 1 + Math.floor(Math.random() * WIZ_MAX),
                        ),
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-night/40 px-3 py-2.5 text-sm text-mute transition-colors hover:border-orange/40 hover:text-ink"
                  >
                    <Dices className="size-4" /> Random
                  </button>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-faint">
                  {wizNum === ""
                    ? `Enter 1–${WIZ_MAX} to summon that wizard`
                    : !wizValid
                      ? `Pick a number from 1 to ${WIZ_MAX}`
                      : !wizMinted
                        ? `#${wizValue} wasn't minted — try another`
                        : wizPreview?.n === wizValue && wizPreview.traits
                          ? wizPreview.traits
                          : `Wizardz #${wizValue}`}
                </p>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Optional: describe a scene for your wizard…"
              className="ring-focus w-full resize-none rounded-xl border border-line bg-night/40 p-3.5 text-ink placeholder:text-faint focus:border-orange/50"
            />
          </div>
        ) : mode === "meme" ? (
          <div className="space-y-2.5">
            {/* preset templates — clicking fills the scene + caption */}
            <div className="flex flex-wrap gap-2">
              {MEME_PRESETS.map((p) => (
                <button
                  key={p.tag}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    memeTag === p.tag
                      ? "border-orange/60 bg-orange/10 text-ink"
                      : "border-line/70 bg-night/40 text-mute hover:border-orange/40 hover:text-ink",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setMemeTag(""); // typing your own scene de-selects the preset chip
              }}
              rows={2}
              placeholder="Pick a meme above, or describe a scene (e.g. red gm)…"
              className="ring-focus w-full resize-none rounded-xl border border-line bg-night/40 p-3.5 text-ink placeholder:text-faint focus:border-orange/50"
            />
            {/* caption text + where it sits — overlaid on the final image as real text */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-xl border border-line bg-night/40 px-3">
                <Type className="size-4 shrink-0 text-faint" />
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={MEME_MAX_CAPTION}
                  placeholder="Caption (e.g. GM)"
                  aria-label="Meme caption"
                  className="ring-focus w-full bg-transparent py-2.5 pl-2 text-ink placeholder:text-faint focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setCaptionPos((p) => (p === "top" ? "bottom" : "top"))}
                title="Caption position"
                aria-label={`Caption position: ${captionPos}`}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line/70 bg-night/40 px-3 py-2.5 text-sm capitalize text-mute transition-colors hover:border-orange/40 hover:text-ink"
              >
                {captionPos === "top" ? (
                  <ArrowUpToLine className="size-4" />
                ) : (
                  <ArrowDownToLine className="size-4" />
                )}
                {captionPos}
              </button>
            </div>
          </div>
        ) : (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={isGif ? "Describe the wizard and the motion…" : "Describe your wizard…"}
            className="ring-focus w-full resize-none rounded-xl border border-line bg-night/40 p-3.5 text-ink placeholder:text-faint focus:border-orange/50"
          />
        )}

        {/* example chips (meme mode uses its own preset buttons above instead) */}
        {mode !== "meme" && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CHIPS[mode].map((c) => (
              <button
                key={c}
                onClick={() => setPrompt(c)}
                className="rounded-full border border-line/70 bg-night/40 px-3 py-1.5 text-xs text-mute transition-colors hover:border-orange/40 hover:text-ink"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* eyes trait picker (image mode) — Auto = parse the prompt; a pick overrides it */}
        {mode === "image" && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <Eye className="size-3" /> Eyes
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEyeSel("")}
                className={cn(
                  "flex h-9 items-center rounded-lg border px-2.5 text-xs font-medium transition-colors",
                  eyeSel === ""
                    ? "border-orange/60 bg-orange/10 text-ink"
                    : "border-line/70 bg-night/40 text-mute hover:border-orange/40 hover:text-ink",
                )}
              >
                Auto
              </button>
              {EYE_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEyeSel(k)}
                  title={EYE_LABELS[k]}
                  aria-label={`${EYE_LABELS[k]} eyes`}
                  className={cn(
                    "grid size-9 place-items-center rounded-lg border bg-night/60 transition-colors",
                    eyeSel === k ? "border-orange/70 ring-1 ring-orange/50" : "border-line/70 hover:border-orange/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand/eyes/${k}.png`} alt={EYE_LABELS[k]} className="max-h-5 max-w-6 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* controls + CTA */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mode === "gif" && (
            <Chip label={`Motion: ${MOTIONS[motionKind]}`} onClick={() => setMotionKind((m) => (m + 1) % MOTIONS.length)} />
          )}

          <button
            onClick={generate}
            disabled={!canGenerate}
            className={cn(
              "ml-auto flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all",
              canGenerate
                ? "bg-gradient-brand text-night hover:opacity-95"
                : "cursor-not-allowed bg-card-2 text-faint",
            )}
          >
            {phase === "loading" || uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : overQuota ? (
              <Lock className="size-4" />
            ) : mode === "gif" ? (
              <Film className="size-4" />
            ) : mode === "recreate" ? (
              <Upload className="size-4" />
            ) : mode === "meme" ? (
              <Laugh className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {overQuota
              ? remaining === 0
                ? "Daily limit reached"
                : `Need ${needed} credits`
              : uploading
                ? "Uploading…"
                : mode === "gif"
                  ? "Animate it"
                  : mode === "recreate"
                    ? "Recreate it"
                    : mode === "wiz"
                      ? wizValid
                        ? `Summon #${wizValue}`
                        : "Enter a #"
                      : mode === "meme"
                        ? "Make the meme"
                        : "Cast the spell"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-line/70 bg-night/40 px-3 py-2 text-xs text-mute transition-colors hover:border-line hover:text-ink"
    >
      {label}
      <ChevronDown className="size-3 text-faint" />
    </button>
  );
}

function CanvasAction({
  icon: Icon,
  label,
  onClick,
  href,
  spinning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  spinning?: boolean;
}) {
  const cls =
    "flex size-8 items-center justify-center rounded-lg bg-night/70 text-mute backdrop-blur transition-colors hover:text-ink";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" download title={label} aria-label={label} className={cls}>
        <Icon className="size-4" />
      </a>
    );
  }
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cls}>
      <Icon className={cn("size-4", spinning && "animate-spin")} />
    </button>
  );
}
