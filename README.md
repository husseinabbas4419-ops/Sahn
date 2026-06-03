# صحن · Sahn — AI food-photo studio (connected to Magnific)

Turns sellers' phone photos of sweets/dishes into professional studio shots.
Browser (app) → **your backend** (holds the key) → Magnific API.

## Why a backend?
Magnific is **server-to-server only** (`x-magnific-api-key`). The key must never sit in
the browser, or anyone can steal it and burn your credits. This server keeps it safe.

## Setup (5 minutes)
1. Install Node.js 18+ (`node -v` to check).
2. In this folder:
   ```bash
   npm install
   cp .env.example .env
   ```
3. Open `.env` and paste your key from https://www.magnific.com/developers/dashboard
4. Start it:
   ```bash
   npm start
   ```
5. Open http://localhost:3000 — upload a photo, pick a style, generate.

If the key isn't set or the server is off, the app falls back to **demo mode** so you can
still show it to sellers.

## Where to tune things
- **`server.js` → `PRESETS`** — the prompt for each style. This is your product's edge;
  refine these with your Photoshop/visual eye until knafeh looks glossy, not plastic.
- **`structure_strength: 65`** — higher = output stays closer to the original dish shape.
  Raise it if the AI changes the food too much; lower it for more dramatic scenes.
- **`IMAGES_PER_REQUEST`** — images returned per generation (each one costs credits).
- **`upscale`** — pass `true` from paid plans only (extra cost; ~€0.10+ per image).

## ⚠️ Confirm before going live
The Mystic request fields (`structure_reference`, `structure_strength`, `aspect_ratio`,
`model`) follow Magnific's documented conventions. **Verify the exact names against your
dashboard's OpenAPI spec** and adjust if any differ — I built this from the public docs,
not your live account.

## Cost & pricing sanity check
Each generation = up to 4 Mystic calls (+ optional upscale). Price your plans so the
monthly fee comfortably covers per-image API cost + margin, and cap images per plan.
The $9 / $19 tiers in the UI are starting points — recompute once you see real per-image cost.

## Deploy
Any Node host works (Render, Railway, Fly.io, a small VPS). Set `MAGNIFIC_API_KEY` as an
environment variable there. Put it behind your domain and connect Whish payment links for billing.
