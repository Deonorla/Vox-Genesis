import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
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
  const possiblePaths = [
    "/Users/deonorla/Library/Python/3.9/bin/edge-tts",
    "/usr/local/bin/edge-tts",
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
  const PORT = 3000;

  app.use(express.json());

  // Initialize Google Gen AI
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API endpoints FIRST
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const selectedVoice = voiceName || "Kore"; // Puck, Charon, Kore, Fenrir, Zephyr
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio content returned from Gemini API. Please make sure the API key is configured correctly.");
      }

      res.json({ audioContent: base64Audio });
    } catch (error: any) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
    }
  });

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

  app.post("/api/enhance-text", async (req, res) => {
    try {
      const { text, style, language } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Text is required" });
      }

      const styleInstruction = style ? `Rewrite this text in the style of a: ${style}.` : "Optimize this text for clear and engaging spoken narration.";
      const languageInstruction = language && language !== "original" ? `Translate the resulting text into: ${language}.` : "Keep the language the same as the input.";

      const prompt = `
You are an expert voice-over and scriptwriter.
Analyze this text and enhance it specifically to be read aloud (audio text-to-speech).
Improve formatting, add conversational naturalness, check for readability, add suitable breathing cues (like commas or small dashes if they help the flow), and make it sound elegant.

Instructions:
1. ${styleInstruction}
2. ${languageInstruction}
3. Ensure the output is natural, clear, and highly engaging for a listener. Keep sentences of moderate length so the TTS sounds natural.
4. Output your response as a JSON object with exactly two fields:
   - "enhancedText": The rewritten, refined text ready for the speaker. Keep it clean without markdown in the text (no asterisks, no headers).
   - "summary": A brief 1-2 sentence description of what adjustments you made (e.g., "Increased conversational flow, added commas for pacing, and translated into Spanish").

Text to enhance:
"""
${text}
"""
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response generated from Gemini API");
      }

      const parsedResult = JSON.parse(resultText);
      res.json(parsedResult);
    } catch (error: any) {
      console.error("Text enhancement error:", error);
      res.status(500).json({ error: error.message || "Failed to enhance text" });
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
