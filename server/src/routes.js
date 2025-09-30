import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import { supabase } from "./supabase.js";
import { verifyIdTokenMiddleware } from "./middleware/verifyIdToken.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();
const router = express.Router();

// -------- auth verify (frontend gönderir id_token)
router.post("/auth/verify", async (req, res) => {
  try {
    // frontend sends Authorization header or body.id_token
    const idToken = req.headers.authorization?.startsWith("Bearer ") 
      ? req.headers.authorization.slice(7)
      : req.body?.id_token;

    if (!idToken) return res.status(400).json({ error: "id_token required" });

    // verify token using google library on server -> reuse verify middleware logic
    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    const email = payload.email;
    const name = payload.name;
    const avatar = payload.picture;

    // upsert user to Supabase
    const { data, error } = await supabase
      .from("users")
      .upsert(
        { email, name, avatar_url: avatar },
        { onConflict: "email", returning: "representation" }
      )
      .select()
      .single();

    if (error) {
      console.error("supabase upsert error", error);
      return res.status(500).json({ error: "db_error", detail: error.message });
    }

    // return user row
    return res.json({ ok: true, user: data });
  } catch (e) {
    console.error("/auth/verify error", e);
    return res.status(500).json({ error: "verify_failed", detail: e.message });
  }
});

// -------- runs: save a completed run (requires auth)
router.post("/runs", verifyIdTokenMiddleware, async (req, res) => {
  try {
    const { route, polygon, bbox, area_m2, walrus_cid, date } = req.body;
    if (!route) return res.status(400).json({ error: "route required" });

    const email = req.authUser.email;
    const runRow = {
      user_email: email,
      date: date || new Date().toISOString().slice(0, 10),
      route,
      polygon: polygon || null,
      bbox: bbox || null,
      area_m2: area_m2 || null,
      walrus_cid: walrus_cid || null
    };

    const { data, error } = await supabase.from("runs").insert(runRow).select().single();
    if (error) {
      console.error("insert run error", error);
      return res.status(500).json({ error: "db_error", detail: error.message });
    }

    // respond created run
    return res.json({ ok: true, run: data });
  } catch (e) {
    console.error("/runs error", e);
    return res.status(500).json({ error: "save_failed", detail: e.message });
  }
});

// GET runs for today (optionally with bbox query)
router.get("/runs/today", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase.from("runs").select("*").eq("date", today);

    // optional bbox filtering on server side: receive bbox=lonMin,latMin,lonMax,latMax
    const bboxStr = req.query.bbox;
    if (bboxStr) {
      const [lonMin, latMin, lonMax, latMax] = bboxStr.split(",").map(Number);
      // simple filter: runs whose bbox overlaps (db-side naive because stored as json)
      // We will fetch all today's runs and filter in JS — okay for small scale.
      const { data: all, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      const filtered = (all || []).filter(r => {
        if (!r.bbox) return true;
        const b = r.bbox;
        return !(b.lonMax < lonMin || b.lonMin > lonMax || b.latMax < latMin || b.latMin > latMax);
      });
      return res.json({ runs: filtered });
    } else {
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ runs: data });
    }
  } catch (e) {
    console.error("/runs/today", e);
    return res.status(500).json({ error: e.message });
  }
});

// posts create
router.post("/posts", verifyIdTokenMiddleware, async (req, res) => {
  try {
    const { content, run_id } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const email = req.authUser.email;
    const { data, error } = await supabase.from("posts").insert({ user_email: email, content, run_id }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, post: data });
  } catch (e) {
    console.error("/posts", e);
    return res.status(500).json({ error: e.message });
  }
});

// groups create & list
router.get("/groups", async (req, res) => {
  try {
    const { data, error } = await supabase.from("groups").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ groups: data });
  } catch (e) {
    console.error("/groups get", e);
    return res.status(500).json({ error: e.message });
  }
});

router.post("/groups", verifyIdTokenMiddleware, async (req, res) => {
  try {
    const { name, description, lng, lat, image_walrus_cid } = req.body;
    if (!name || typeof lng !== "number" || typeof lat !== "number") return res.status(400).json({ error: "name,lng,lat required" });
    const email = req.authUser.email;
    const payload = {
      name,
      description: description || null,
      location: { lon: lng, lat },
      owner_email: email,
      image_walrus_cid: image_walrus_cid || null
    };
    const { data, error } = await supabase.from("groups").insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    // optionally, add owner to members table
    await supabase.from("group_members").insert({ group_id: data.id, user_email: email, role: "owner" });
    return res.json({ ok: true, group: data });
  } catch (e) {
    console.error("/groups post", e);
    return res.status(500).json({ error: e.message });
  }
});

// -------- Walrus upload proxy (multipart)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload/walrus", verifyIdTokenMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });

    // send file buffer to WALRUS_NODE
    const walrusNode = process.env.WALRUS_NODE;
    if (!walrusNode) return res.status(500).json({ error: "walrus not configured" });

    // Example: POST to walrus endpoint that expects raw body
    // Adjust to actual Walrus API (headers, formData) accordingly
    const url = `${walrusNode}/store`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": req.file.mimetype,
        ...(process.env.WALRUS_API_KEY ? { "Authorization": `Bearer ${process.env.WALRUS_API_KEY}` } : {})
      },
      body: req.file.buffer
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("walrus upload failed", r.status, text);
      return res.status(500).json({ error: "walrus_upload_failed", detail: text });
    }

    const json = await r.json();
    // expect walrus returns { cid, url } (adjust per your Walrus node)
    return res.json({ ok: true, result: json });
  } catch (e) {
    console.error("/upload/walrus error", e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /me endpoint
router.get("/me", verifyIdTokenMiddleware, async (req, res) => {
  try {
    const email = req.authUser.email;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data });
  } catch (e) {
    console.error("/me error", e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;