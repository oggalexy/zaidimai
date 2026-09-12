import express from "express";
import session from "express-session";
import multer from "multer";
import Database from "better-sqlite3";
import sanitizeFilename from "sanitize-filename";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_ME";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE_ME";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, "data");
const gamesDir = path.join(dataDir, "games");
fs.mkdirSync(gamesDir, { recursive: true });

const db = new Database(path.join(dataDir, "site.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

function safePath(base, relativeName) {
  const clean = sanitizeFilename(relativeName).replace(/\\/g, "/");
  if (!clean || clean.startsWith(".") || clean.includes("..")) return null;
  const destination = path.resolve(base, clean);
  const resolvedBase = path.resolve(base) + path.sep;
  if (!destination.startsWith(resolvedBase)) return null;
  return destination;
}

function createId() {
  return crypto.randomBytes(8).toString("hex");
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    files: 100,
    fileSize: 25 * 1024 * 1024
  }
});

app.get("/api/me", (req, res) => {
  res.json({ admin: Boolean(req.session?.isAdmin) });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Neteisingi prisijungimo duomenys." });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/games", (req, res) => {
  const games = db.prepare(`
    SELECT id, title, image, created_at, updated_at
    FROM games
    ORDER BY created_at DESC
  `).all();
  res.json(games);
});

app.get("/api/games/:id", (req, res) => {
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.id);
  if (!game) return res.status(404).json({ error: "Žaidimas nerastas." });
  res.json(game);
});

app.post("/api/admin/games",
  requireAdmin,
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "files", maxCount: 100 }
  ]),
  (req, res) => {
    const title = String(req.body.title || "").trim();
    const cover = req.files?.cover?.[0];
    const gameFiles = req.files?.files || [];

    if (!title) return res.status(400).json({ error: "Įrašyk žaidimo pavadinimą." });
    if (!cover) return res.status(400).json({ error: "Įkelk žaidimo paveikslėlį." });
    if (!gameFiles.some(f => f.originalname.toLowerCase() === "index.html")) {
      return res.status(400).json({ error: "Žaidimo failuose turi būti index.html." });
    }

    const id = createId();
    const dir = path.join(gamesDir, id);
    fs.mkdirSync(dir, { recursive: true });

    try {
      const coverName = "cover" + path.extname(sanitizeFilename(cover.originalname)).toLowerCase();
      fs.writeFileSync(path.join(dir, coverName), cover.buffer);

      for (const file of gameFiles) {
        const target = safePath(dir, file.originalname);
        if (!target) throw new Error(`Neleistinas failo pavadinimas: ${file.originalname}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.buffer);
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO games (id, title, image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, title, `/games/${id}/${coverName}`, now, now);

      res.json({ ok: true, id });
    } catch (err) {
      fs.rmSync(dir, { recursive: true, force: true });
      res.status(400).json({ error: err.message || "Nepavyko įkelti žaidimo." });
    }
  }
);

app.put("/api/admin/games/:id",
  requireAdmin,
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "files", maxCount: 100 }
  ]),
  (req, res) => {
    const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.id);
    if (!game) return res.status(404).json({ error: "Žaidimas nerastas." });

    const title = String(req.body.title || "").trim();
    const cover = req.files?.cover?.[0];
    const gameFiles = req.files?.files || [];

    if (!title) return res.status(400).json({ error: "Įrašyk žaidimo pavadinimą." });
    if (!gameFiles.some(f => f.originalname.toLowerCase() === "index.html")) {
      return res.status(400).json({ error: "Atnaujinime turi būti index.html." });
    }

    const dir = path.join(gamesDir, game.id);
    const tempDir = path.join(gamesDir, `${game.id}-tmp-${crypto.randomBytes(4).toString("hex")}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      let coverName = path.basename(game.image);
      if (cover) {
        coverName = "cover" + path.extname(sanitizeFilename(cover.originalname)).toLowerCase();
        fs.writeFileSync(path.join(tempDir, coverName), cover.buffer);
      } else {
        const oldCover = path.join(dir, path.basename(game.image));
        if (fs.existsSync(oldCover)) fs.copyFileSync(oldCover, path.join(tempDir, coverName));
      }

      for (const file of gameFiles) {
        const target = safePath(tempDir, file.originalname);
        if (!target) throw new Error(`Neleistinas failo pavadinimas: ${file.originalname}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.buffer);
      }

      fs.rmSync(dir, { recursive: true, force: true });
      fs.renameSync(tempDir, dir);

      const now = new Date().toISOString();
      const imagePath = `/games/${game.id}/${coverName}`;
      db.prepare(`
        UPDATE games SET title = ?, image = ?, updated_at = ? WHERE id = ?
      `).run(title, imagePath, now, game.id);

      res.json({ ok: true });
    } catch (err) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      res.status(400).json({ error: err.message || "Nepavyko atnaujinti žaidimo." });
    }
  }
);

app.delete("/api/admin/games/:id", requireAdmin, (req, res) => {
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.id);
  if (!game) return res.status(404).json({ error: "Žaidimas nerastas." });

  fs.rmSync(path.join(gamesDir, game.id), { recursive: true, force: true });
  db.prepare("DELETE FROM games WHERE id = ?").run(game.id);

  res.json({ ok: true });
});

app.use("/games", express.static(gamesDir, {
  index: "index.html",
  dotfiles: "deny"
}));

app.use(express.static(path.join(__dirname, "public")));

app.get("/play/:id", (req, res) => {
  const game = db.prepare("SELECT id FROM games WHERE id = ?").get(req.params.id);
  if (!game) return res.status(404).send("Žaidimas nerastas.");
  res.sendFile(path.join(gamesDir, game.id, "index.html"));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/login", (req, res) => {
  if (req.session?.isAdmin) return res.redirect("/admin");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => {
  console.log(`HTML Game Site running on http://localhost:${PORT}`);
});
