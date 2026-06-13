# Deploying Wizardz AI Studio

The app is a standard **Next.js 16** app. Two easy paths:

## Option A — Cloudflare (free, commercial-OK) — configured here

Uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Config is already in
`wrangler.jsonc` + `open-next.config.ts`, and `npm run preview` / `npm run deploy` are wired.

**1. Log in (one-time):**
```bash
npx wrangler login
```

**2. Set your secrets** (these are NEVER committed — they live in Cloudflare):
```bash
npx wrangler secret put FAL_KEY            # your fal.ai key
npx wrangler secret put FAL_MASTER_URL     # PRIMARY engine — canonical master on fal.storage (the locked look)
npx wrangler secret put FAL_STYLE_REF_URL  # banner key-art on fal.storage (Kontext anchor fallback)
npx wrangler secret put FAL_LORA_URL       # trained Wizardz LoRA (fallback if master unset)
npx wrangler secret put AUTH_SECRET        # REQUIRED for the holder gate — any long random string
npx wrangler secret put ORDISCAN_API_KEY   # free key from ordiscan.com — powers ownership checks
# optional:
npx wrangler secret put OPENAI_API_KEY     # only for the legacy neck-judge / gpt-image-2 HD path
npx wrangler secret put FAL_LORA_SCALE     # e.g. 1
```
> **Engine:** with `FAL_MASTER_URL` set, the studio recolors/scene-swaps the user-approved canonical
> master via Kontext — output is locked to the exact look (no necks), so the OpenAI neck-judge is no
> longer on the hot path. ⚠️ **`AUTH_SECRET` is required in production** (else holder sessions sign
> with a random per-restart key and keep dropping).

**3. Create the KV namespace** (durable quota / rate-limit / history — the cap is bypassable without it):
```bash
npx wrangler kv namespace create WIZ_KV
```
Paste the printed `id` into the `kv_namespaces` binding in `wrangler.jsonc` (replaces
`REPLACE_WITH_KV_NAMESPACE_ID`). Until this is set, the app runs on per-isolate in-memory state.

**4. Preview locally on the real Workers runtime:**
```bash
npm run preview
```

**5. Deploy:**
```bash
npm run deploy
```
Wrangler prints your live URL (`https://wizardz-ai-studio.<you>.workers.dev`). Add a custom
domain in the Cloudflare dashboard when ready.

> First Cloudflare build on Next 16 can surface adapter quirks — if `npm run preview` errors,
> bump `@opennextjs/cloudflare` and check their Next-version support notes.

## Option B — Vercel (zero-config, easiest)

```bash
npx vercel            # link + deploy a preview
npx vercel --prod     # production
```
Then add `FAL_KEY`, `FAL_LORA_URL` (and optional `FAL_LORA_SCALE`) as Environment Variables in
the Vercel dashboard. (Note: Vercel's free Hobby tier is non-commercial — fine for testing,
use Pro for a public commercial launch.)

## Env vars / secrets needed in production
| Key | Required | What |
|---|---|---|
| `FAL_KEY` | ✅ | fal.ai API key (server-side only) |
| `FAL_MASTER_URL` | ✅ | **PRIMARY engine** — canonical master on fal.storage; recolored/scene-swapped per request (the locked look) |
| `FAL_STYLE_REF_URL` | rec. | banner key-art on fal.storage — Kontext anchor fallback |
| `FAL_LORA_URL` | rec. | trained Wizardz LoRA — fallback if master unset |
| `OPENAI_API_KEY` | ✅ (for gate) | gpt-5-mini neck judge on every image (fails open if unset) |
| `AUTH_SECRET` | ✅ (for gate) | long random string — signs holder sessions (else forgeable/non-persistent) |
| `ORDISCAN_API_KEY` | for gate | free key from [ordiscan.com](https://ordiscan.com) — on-chain ownership lookup |
| `SATFLOW_API_KEY` | alt | alternative ownership source + live floor |
| `FAL_LORA_SCALE` | optional | default `1` |
| `IMAGE_ENGINE` | optional | `openai` = use the slow gpt-image-2 HD path; default = the fast LoRA |
| `ALLOW_DEV_HOLDER` | dev only | `1` = treat any connected wallet as a holder (never honored in prod) |

…and one binding (not a secret): **`WIZ_KV`** (KV namespace, step 3).

## Known follow-ups
- **KV is wired** (quota / rate-limit / history use `lib/kv.ts` → `WIZ_KV`). Two notes: create the
  namespace (step 3), and KV's read-modify-write isn't perfectly atomic — for strict cap atomicity
  under heavy abuse, migrate the quota counter to a **Durable Object**. Add **Turnstile** on the
  public teaser + a fal/OpenAI **budget kill-switch** before a big launch.
- **Verify on first deploy:** `bip322-js` uses WASM secp256k1 — confirm `/api/auth/verify` works under
  `npm run preview` (Workers runtime) before relying on the gate. Also confirm `getCloudflareContext()`
  resolves `WIZ_KV` there (the in-memory fallback hides a missing binding).
- **R2 image hosting** is only needed if you enable the OpenAI HD engine (`IMAGE_ENGINE=openai`), whose
  output is inline; the default LoRA path returns durable `fal.media` URLs already.
- **Art-wall** hotlinks GIFs from `ord.satflow.com`; cache to **R2 / Images** for a light first paint.
