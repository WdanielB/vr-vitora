require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5500;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate random 4-character alphanumeric code (uppercase)
const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Ensure code is unique
const generateUniqueCode = async () => {
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    const { data } = await supabase.from("markers").select("id").eq("code", code).single();
    if (!data) break;
    attempts++;
  } while (attempts < 100);
  return code;
};

const DEFAULT_MARKER = {
  id: "mindar-demo",
  name: "Cuadro de demostración",
  description: "Cuadro de ejemplo para probar la experiencia AR.",
  image_url: "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind",
  video_url: "/ar-experience/assets/experience.mp4",
  code: "DEMO",
  active: true,
};

// Serialize marker from Supabase format
const serializeMarker = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || "",
  imageUrl: row.image_url,
  videoUrl: row.video_url,
  code: row.code,
  active: row.active,
  createdAt: row.created_at,
});

// Database operations
const getAllMarkers = async () => {
  const { data, error } = await supabase
    .from("markers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(serializeMarker);
};

const getMarkerById = async (id) => {
  const { data, error } = await supabase.from("markers").select("*").eq("id", id).single();
  if (error || !data) return null;
  return serializeMarker(data);
};

const getMarkerByCode = async (code) => {
  const { data, error } = await supabase
    .from("markers")
    .select("*")
    .ilike("code", code)
    .single();
  if (error || !data) return null;
  return serializeMarker(data);
};

const getActiveMarker = async () => {
  const { data, error } = await supabase
    .from("markers")
    .select("*")
    .eq("active", true)
    .limit(1)
    .single();
  if (error || !data) return null;
  return serializeMarker(data);
};

const ensureDefaultSeed = async () => {
  const { count } = await supabase.from("markers").select("*", { count: "exact", head: true });
  if (count === 0) {
    await supabase.from("markers").insert({
      id: DEFAULT_MARKER.id,
      name: DEFAULT_MARKER.name,
      description: DEFAULT_MARKER.description,
      image_url: DEFAULT_MARKER.image_url,
      video_url: DEFAULT_MARKER.video_url,
      code: DEFAULT_MARKER.code,
      active: true,
    });
  }
};

const validatePayload = ({ name, imageUrl, videoUrl }) => {
  if (!name || !name.trim()) throw new Error("El nombre es obligatorio");
  if (!imageUrl || !imageUrl.trim()) throw new Error("La URL de la imagen target es obligatoria");
  if (!videoUrl || !videoUrl.trim()) throw new Error("La URL del video es obligatoria");
};

// Initialize
ensureDefaultSeed().catch(console.error);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Routes
app.get("/api/markers", async (req, res) => {
  try {
    const markers = await getAllMarkers();
    const activeMarker = await getActiveMarker();
    res.json({ markers, activeMarker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/markers/active", async (req, res) => {
  try {
    const marker = await getActiveMarker();
    res.json({ marker: marker || serializeMarker(DEFAULT_MARKER) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/markers/code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || code.length !== 4) {
      return res.status(400).json({ error: "Código inválido" });
    }
    const marker = await getMarkerByCode(code.toUpperCase());
    if (!marker) {
      return res.status(404).json({ error: "Código no encontrado" });
    }
    res.json({
      marker: {
        name: marker.name,
        imageUrl: marker.imageUrl,
        videoUrl: marker.videoUrl,
        code: marker.code,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/markers", async (req, res) => {
  try {
    validatePayload(req.body || {});
    const code = await generateUniqueCode();
    const marker = {
      id: crypto.randomUUID(),
      name: req.body.name.trim(),
      description: req.body.description?.trim() || "",
      image_url: req.body.imageUrl?.trim() || "",
      video_url: req.body.videoUrl.trim(),
      code,
      active: false,
    };
    const { error } = await supabase.from("markers").insert(marker);
    if (error) throw error;
    const created = await getMarkerById(marker.id);
    res.status(201).json({ marker: created });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo guardar" });
  }
});

// UPDATE marker
app.put("/api/markers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getMarkerById(id);
    if (!existing) {
      return res.status(404).json({ error: "Marcador no encontrado" });
    }
    
    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.imageUrl) updates.image_url = req.body.imageUrl.trim();
    if (req.body.videoUrl) updates.video_url = req.body.videoUrl.trim();
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    
    const { error } = await supabase.from("markers").update(updates).eq("id", id);
    if (error) throw error;
    
    const updated = await getMarkerById(id);
    res.json({ marker: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/markers/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const marker = await getMarkerById(id);
    if (!marker) {
      return res.status(404).json({ error: "Marcador no encontrado" });
    }
    // Deactivate all
    await supabase.from("markers").update({ active: false }).neq("id", "");
    // Activate this one
    await supabase.from("markers").update({ active: true }).eq("id", id);
    const activeMarker = await getActiveMarker();
    res.json({ activeMarker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/markers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const marker = await getMarkerById(id);
    if (!marker) {
      return res.status(404).json({ error: "Marcador no encontrado" });
    }
    await supabase.from("markers").delete().eq("id", id);
    await ensureDefaultSeed();
    const markers = await getAllMarkers();
    const activeMarker = await getActiveMarker();
    res.json({ success: true, markers, activeMarker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reset", async (req, res) => {
  try {
    await supabase.from("markers").delete().neq("id", "");
    await supabase.from("markers").insert({
      id: DEFAULT_MARKER.id,
      name: DEFAULT_MARKER.name,
      description: DEFAULT_MARKER.description,
      image_url: DEFAULT_MARKER.image_url,
      video_url: DEFAULT_MARKER.video_url,
      code: DEFAULT_MARKER.code,
      active: true,
    });
    const markers = await getAllMarkers();
    const activeMarker = await getActiveMarker();
    res.json({ markers, activeMarker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use(express.static(__dirname));

app.use((err, req, res, next) => {
  console.error("API error", err);
  res.status(500).json({ error: "Error interno" });
});

// Get local IP
const getLocalIP = () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
};

const localIP = getLocalIP();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 VR VITORA server running!`);
  console.log(`\n📦 Base de datos: Supabase`);
  console.log(`\n💻 Local: http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}\n`);
});
