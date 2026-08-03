import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";

const execFileAsync = promisify(execFile);

dotenv.config();

// Detect edge-tts binary path at startup for portability
let edgeTtsPath = "edge-tts";
try {
  edgeTtsPath = execSync("which edge-tts", { encoding: "utf-8" }).trim();
} catch {
  // Fallback paths for different environments
  const possiblePaths = [
    "/usr/local/bin/edge-tts",
    "/usr/bin/edge-tts",
    "/Users/deonorla/Library/Python/3.9/bin/edge-tts",
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      edgeTtsPath = p;
      break;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Edge TTS endpoint — uses Microsoft Edge's free neural TTS (no API key needed)
  app.post("/api/edge-tts", async (req, res) => {
    try {
      const { text, voiceName } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Text is required" });
      }

      const selectedVoice = voiceName || "en-US-ChristopherNeural";
      const tmpFile = path.join(os.tmpdir(), `edge-tts-${Date.now()}.mp3`);

      await execFileAsync(edgeTtsPath, [
        "--text", text,
        "--voice", selectedVoice,
        "--write-media", tmpFile,
      ], { timeout: 120000 });

      const audioBuffer = fs.readFileSync(tmpFile);
      const base64Audio = audioBuffer.toString("base64");

      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      res.json({ audioContent: base64Audio });
    } catch (error: any) {
      console.error("Edge TTS generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech with Edge TTS" });
    }
  });

  // Serve static assets or use Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
});
