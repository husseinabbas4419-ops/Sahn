/**
 * صحن · Sahn — backend
 * Browser → THIS server (holds your key) → Magnific API
 *
 * Run:  npm install  →  set MAGNIFIC_API_KEY in .env  →  npm start
 */
import express from "express";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "25mb" })); // base64 images can be large
app.use(express.static("public"));        // serves public/index.html (the app)

const API = "https://api.magnific.com";
const KEY = process.env.MAGNIFIC_API_KEY;
const HEADERS = { "x-magnific-api-key": KEY, "Content-Type": "application/json" };

/* How many styled photos to return per request. Each one = one Mystic call = cost. */
const IMAGES_PER_REQUEST = 4;

/* ---- Preset → prompt map (THIS is where your visual expertise lives) ----
 * Tune these prompts; they are the product's "secret sauce".
 * structure_reference = the seller's photo, so the real dish stays accurate. */
const PRESETS = {
  ramadan: "Professional food photography, festive Ramadan & Eid setting, warm golden lighting, ornate brass lantern (fanous) and dates softly blurred in the background, elegant dark wooden table, glossy appetizing highlights, high-end restaurant menu hero shot, ultra realistic, 8k",
  marble:  "Luxury food photography on polished white marble with gold accents, soft diffused studio lighting, premium Middle Eastern patisserie presentation, glossy honey highlights, clean elegant composition, ultra realistic, 8k",
  cafe:    "Bright airy cafe food photography, natural soft morning daylight, light wood and cream tones, fresh inviting styling, shallow depth of field, modern minimal, ultra realistic, 8k",
  dark:    "Dark moody fine-dining food photography, dramatic side lighting, deep shadows, elegant dark slate background, steam and texture detail, restaurant menu hero shot, ultra realistic, 8k",
  flat:    "Top-down flat-lay food photography, clean styled composition, neutral soft background, even diffused lighting, menu catalog style, crisp and appetizing, ultra realistic, 8k",
  story:   "Vertical 9:16 social media food photography, vibrant appetizing colors, clean uncluttered background with empty copy space at the top for text, instagram story format, ultra realistic, 8k",
};
const ANGLES = ["hero centered shot", "45-degree angle", "close-up macro detail", "styled with props"];

/* Strip "data:image/...;base64," prefix if present — Magnific wants the raw base64 (or a URL). */
const cleanBase64 = (s) => (typeof s === "string" && s.startsWith("data:")) ? s.split(",")[1] : s;

/* Poll an async task until it finishes (or times out). */
async function pollTask(path, { tries = 40, waitMs = 2500 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${API}${path}`, { headers: HEADERS });
    const j = await r.json();
    const d = j.data || j;
    const status = (d.status || "").toUpperCase();
    if (status === "COMPLETED") return d;
    if (status === "FAILED" || status === "ERROR") throw new Error("Magnific task failed");
    await new Promise((res) => setTimeout(res, waitMs));
  }
  throw new Error("Magnific task timed out");
}

/* Generate ONE styled photo: Mystic (restyle, keep dish) → optional upscale. */
async function generateOne(base64, presetId, angle, { upscale = false } = {}) {
  const prompt = `${PRESETS[presetId]}, ${angle}`;

  // 1) Mystic — uses the seller's photo as structure reference so the dish stays accurate.
  //    NOTE: confirm these field names against your dashboard OpenAPI spec.
  const genRes = await fetch(`${API}/v1/ai/mystic`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      prompt,
      structure_reference: base64,   // the real product photo
      structure_strength: 65,        // 0-100: higher = stays closer to original shape. TUNE THIS.
      resolution: "2k",
      aspect_ratio: presetId === "story" ? "social_story_9_16" : "square_1_1",
      model: "realism",
    }),
  });
  const gen = await genRes.json();
  if (!genRes.ok) throw new Error(JSON.stringify(gen));
  const taskId = (gen.data || gen).task_id;

  const done = await pollTask(`/v1/ai/mystic/${taskId}`);
  let imageUrl = (done.generated && done.generated[0]) || done.images?.[0] || done.url;

  // 2) (Optional) Upscale for crisp menus / print. Costs extra — gate behind paid plans.
  if (upscale && imageUrl) {
    const upRes = await fetch(`${API}/v1/ai/image-upscaler`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ image: imageUrl, scale_factor: "2x", optimized_for: "food", creativity: 3 }),
    });
    const up = await upRes.json();
    if (upRes.ok) {
      const upId = (up.data || up).task_id;
      const upDone = await pollTask(`/v1/ai/image-upscaler/${upId}`);
      imageUrl = (upDone.generated && upDone.generated[0]) || upDone.url || imageUrl;
    }
  }
  return imageUrl;
}

/* ---- The route the app calls ---- */
app.post("/api/generate", async (req, res) => {
  try {
    if (!KEY) return res.status(500).json({ error: "MAGNIFIC_API_KEY is not set on the server" });
    const { image, preset, upscale } = req.body;
    if (!image || !PRESETS[preset]) return res.status(400).json({ error: "image and a valid preset are required" });

    const base64 = cleanBase64(image);
    // Run the 4 angles in parallel.
    const jobs = ANGLES.slice(0, IMAGES_PER_REQUEST).map((a) =>
      generateOne(base64, preset, a, { upscale: !!upscale }).catch((e) => {
        console.error("one image failed:", e.message);
        return null;
      })
    );
    const images = (await Promise.all(jobs)).filter(Boolean);
    if (!images.length) return res.status(502).json({ error: "Generation failed — check key, credits, and field names" });
    res.json({ images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`صحن backend running on http://localhost:${process.env.PORT || 3000}`)
);
