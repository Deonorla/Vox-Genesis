export type TtsEngine = "gemini" | "edge";

export interface Voice {
  id: string;
  name: string;
  gender: "male" | "female";
  traits: string[];
  description: string;
  sampleText: string;
  isCloned?: boolean;
  baseVoiceId?: string;
  sampleAudio?: string;
  engine?: TtsEngine;
}

export interface GeneratedAudio {
  id: string;
  title: string;
  text: string;
  voiceName: string;
  audioContent: string; // Base64 audio content from server
  timestamp: string;
  duration?: number; // duration in seconds
}

export interface PresetText {
  id: string;
  title: string;
  category: string;
  text: string;
}

export interface EnhanceResult {
  enhancedText: string;
  summary: string;
}

export interface StoryBlock {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  audioContent?: string; // Base64 audio content
  duration?: number; // Duration of the whole audio clip in seconds
  trimStart: number; // Trim start offset in seconds
  trimEnd: number; // Trim end offset in seconds
}

export interface Story {
  id: string;
  title: string;
  updatedAt: string;
  blocks: StoryBlock[];
}

