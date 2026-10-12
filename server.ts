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

// ---------------------------------------------------------------------------
// Azure Speech fallback (optional).
//
// Microsoft periodically breaks the free Edge Read-Aloud endpoint that the
// edge-tts CLI relies on (last time: Oct 10, 2026 — see
// https://github.com/rany2/edge-tts/issues/490). When that happens, requests
// fall back to the official Azure Speech REST API, which serves the same
// neural voices and has a free tier (F0: 500K characters/month).
//
// To enable, set in the environment:
//   AZURE_SPEECH_KEY     - key from Azure Portal > Speech service > Keys & Endpoint
//   AZURE_SPEECH_REGION  - e.g. "westus", "westeurope", "southeastasia"
//
// Optional:
//   AZURE_TTS_URL        - full endpoint override (sovereign clouds / testing)
//   EDGE_TTS_DISABLED    - "true" to skip edge-tts entirely and always use Azure
// ---------------------------------------------------------------------------
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY?.trim();
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION?.trim();
const EDGE_TTS_DISABLED = process.env.EDGE_TTS_DISABLED === "true";

const azureFallbackEnabled = Boolean(AZURE_SPEECH_KEY && AZURE_SPEECH_REGION);

function azureTtsUrl(): string {
  const override = process.env.AZURE_TTS_URL?.trim();
  if (override) return override;
  return `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

/** Escape a string so it is safe to embed in SSML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Extract a short, log-friendly message from an error (drops long tracebacks). */
function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const firstLine = message.split("\n")[0]?.trim();
  return firstLine || message;
}

/** Run the edge-tts CLI and return the generated MP3 audio. */
async function synthesizeWithEdgeTts(text: string, voiceName: string): Promise<Buffer> {
  const tmpFile = path.join(os.tmpdir(), `edge-tts-${Date.now()}.mp3`);
  try {
    await execFileAsync(
      edgeTtsPath,
      [
        "--text", text,
        "--voice", voiceName,
        "--write-media", tmpFile,
      ],
      { timeout: 120000 },
    );
    return fs.readFileSync(tmpFile);
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Call the Azure Speech REST API directly (no SDK needed — plain fetch).
 * Edge voice IDs (e.g. "en-US-AriaNeural") are valid Azure voice names, so the
 * frontend can keep sending them unchanged.
 */
async function synthesizeWithAzure(text: string, voiceName: string): Promise<Buffer> {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    throw new Error("Azure Speech fallback is not configured (set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)");
  }

  // Voice names follow the "{locale}-{Name}Neural" pattern; use the locale for xml:lang.
  const xmlLang = /^[a-z]{2,3}-[A-Za-z0-9]+/.test(voiceName)
    ? voiceName.match(/^[a-z]{2,3}-[A-Za-z0-9]+/)![0]
    : "en-US";

  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>` +
    `<voice name='${escapeXml(voiceName)}'>${escapeXml(text)}</voice>` +
    `</speak>`;

  const res = await fetch(azureTtsUrl(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      // Same format edge-tts produces (24kHz mono MP3), so the frontend plays it identically.
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "VoxGenesis/1.0",
    },
    body: ssml,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Azure TTS request failed (${res.status} ${res.statusText})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  return Buffer.from(await res.arrayBuffer());
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // TTS endpoint — primary engine is the free Microsoft Edge neural TTS (via the
  // edge-tts CLI, no API key needed); optional Azure Speech fallback when the
  // Edge endpoint breaks or EDGE_TTS_DISABLED=true.
  app.post("/api/edge-tts", async (req, res) => {
    try {
      const { text, voiceName } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Text is required" });
      }

      const selectedVoice = voiceName || "en-US-ChristopherNeural";
      let audioBuffer: Buffer;
      let engine: "edge" | "azure" = "edge";

      if (EDGE_TTS_DISABLED) {
        // Explicitly bypass edge-tts (e.g. while Microsoft has the Edge endpoint broken).
        audioBuffer = await synthesizeWithAzure(text, selectedVoice);
        engine = "azure";
      } else {
        try {
          audioBuffer = await synthesizeWithEdgeTts(text, selectedVoice);
        } catch (edgeError) {
          if (!azureFallbackEnabled) {
            // No fallback configured — preserve the previous behavior (surface the edge-tts error).
            throw edgeError;
          }
          console.warn(`edge-tts failed (${shortError(edgeError)}) — retrying with Azure Speech fallback...`);
          try {
            audioBuffer = await synthesizeWithAzure(text, selectedVoice);
            engine = "azure";
          } catch (azureError) {
            throw new Error(
              `edge-tts failed (${shortError(edgeError)}) and Azure fallback failed (${shortError(azureError)})`,
            );
          }
        }
      }

      res.json({ audioContent: audioBuffer.toString("base64"), engine });
    } catch (error: any) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
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
    if (EDGE_TTS_DISABLED) {
      console.log("Edge TTS engine is DISABLED (EDGE_TTS_DISABLED=true) — all requests use Azure Speech.");
    }
    console.log(
      azureFallbackEnabled
        ? `Azure Speech fallback: ENABLED (region: ${AZURE_SPEECH_REGION})`
        : "Azure Speech fallback: not configured (set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to enable)",
    );
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
});
