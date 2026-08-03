import { Voice, PresetText } from "./types";

export const PRESETS: PresetText[] = [
  {
    id: "meditation",
    title: "Calm Mind Guide",
    category: "Meditation & Sleep",
    text: "Take a deep breath in... hold it for a moment... and gently let it go. Allow your shoulders to drop, and feel the natural, effortless rhythm of your breathing. You are present, you are safe, and you are exactly where you need to be."
  },
  {
    id: "news",
    title: "Atmospheric News Update",
    category: "Broadcast & News",
    text: "This is a special weather bulletin. Atmospheric research teams have just detected a remarkable auroral display visible as far south as mid-latitudes tonight. Observers are advised to seek dark skies for optimal viewing of this rare cosmic display."
  },
  {
    id: "pitch",
    title: "Product Keynote Intro",
    category: "Business Pitch",
    text: "We've always believed that technology should feel invisible—that the tools we use should amplify our creativity, not get in its way. Today, we're taking that philosophy to its next natural conclusion. Here is what we've built."
  },
  {
    id: "fable",
    title: "Pip's Magical Acorn",
    category: "Storytelling",
    text: "Deep in the ancient Whispering Woods, there lived a tiny, adventurous squirrel named Pip. Unlike the other squirrels who only collected dry acorns, Pip collected stories. And tonight, he was about to discover the most magical story of all."
  },
  {
    id: "assistant",
    title: "Morning briefing assistant",
    category: "Virtual Assistant",
    text: "Good morning! It looks like there's a light breeze outside with completely clear skies. Your first meeting is at ten AM, and I've already prepared your morning briefing documents. Let me know if you'd like to hear them now."
  }
];

export const EDGE_TTS_VOICES: Voice[] = [
  {
    id: "en-US-ChristopherNeural",
    name: "Christopher",
    gender: "male",
    traits: ["Reliable", "Authority", "News"],
    description: "Professional male voice — ideal for news, documentaries, and formal narration.",
    sampleText: "Breaking news today as world leaders gather for an unprecedented summit on climate action.",
    engine: "edge"
  },
  {
    id: "en-US-AriaNeural",
    name: "Aria",
    gender: "female",
    traits: ["Positive", "Confident", "News"],
    description: "Clear and confident female voice — great for news, presentations, and audiobooks.",
    sampleText: "Welcome to today's briefing. Here are the top stories you need to know about.",
    engine: "edge"
  },
  {
    id: "en-US-BrianNeural",
    name: "Brian",
    gender: "male",
    traits: ["Approachable", "Casual", "Conversational"],
    description: "Warm and approachable male voice — perfect for podcasts, storytelling, and casual narration.",
    sampleText: "Hey there! Let me walk you through what happened today — it's quite the story.",
    engine: "edge"
  },
  {
    id: "en-US-AvaNeural",
    name: "Ava",
    gender: "female",
    traits: ["Expressive", "Caring", "Friendly"],
    description: "Warm and expressive female voice — excellent for audiobooks, guided meditation, and gentle narration.",
    sampleText: "Take a moment to breathe deeply. Let the calm settle around you like a warm blanket.",
    engine: "edge"
  },
  {
    id: "en-US-EmmaNeural",
    name: "Emma",
    gender: "female",
    traits: ["Cheerful", "Clear", "Conversational"],
    description: "Cheerful and conversational female voice — great for tutorials, assistants, and friendly narration.",
    sampleText: "Good morning! I've got your daily summary ready — let's jump right in.",
    engine: "edge"
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy",
    gender: "male",
    traits: ["Passion", "Dynamic", "Energetic"],
    description: "Energetic and passionate male voice — perfect for advertisements, promos, and exciting announcements.",
    sampleText: "Are you ready? Because what we're about to share changes everything you thought you knew.",
    engine: "edge"
  },
  {
    id: "en-US-JennyNeural",
    name: "Jenny",
    gender: "female",
    traits: ["Friendly", "Comfort", "General"],
    description: "Friendly and warm general-purpose female voice — works for almost any narration context.",
    sampleText: "Hi there! I'm here to help you with whatever you need today.",
    engine: "edge"
  },
  {
    id: "en-US-RogerNeural",
    name: "Roger",
    gender: "male",
    traits: ["Lively", "Engaging", "News"],
    description: "Lively and engaging male voice — ideal for broadcasts, sports commentary, and energetic reads.",
    sampleText: "What a game! The final seconds were absolutely electrifying.",
    engine: "edge"
  },
  {
    id: "en-US-MichelleNeural",
    name: "Michelle",
    gender: "female",
    traits: ["Friendly", "Pleasant", "News"],
    description: "Pleasant and friendly female voice — great for weather reports, briefings, and informational content.",
    sampleText: "Today's forecast calls for clear skies with a gentle breeze rolling in from the coast.",
    engine: "edge"
  },
  {
    id: "en-GB-SoniaNeural",
    name: "Sonia",
    gender: "female",
    traits: ["British", "Elegant", "Professional"],
    description: "Elegant British female voice — perfect for formal narration, documentaries, and sophisticated content.",
    sampleText: "The history of this remarkable institution stretches back over four centuries.",
    engine: "edge"
  },
  {
    id: "en-GB-RyanNeural",
    name: "Ryan",
    gender: "male",
    traits: ["British", "Warm", "Confident"],
    description: "Warm British male voice — excellent for audiobooks, podcasts, and formal British narration.",
    sampleText: "There is something uniquely compelling about a story that unfolds under moonlight.",
    engine: "edge"
  },
  {
    id: "en-AU-NatashaNeural",
    name: "Natasha",
    gender: "female",
    traits: ["Australian", "Bright", "Friendly"],
    description: "Bright Australian female voice — great for regional content and friendly narrations.",
    sampleText: "G'day! Let me take you through the highlights of today's events.",
    engine: "edge"
  },
  {
    id: "en-IN-NeerjaNeural",
    name: "Neerja",
    gender: "female",
    traits: ["Indian", "Expressive", "Clear"],
    description: "Clear and expressive Indian English voice — ideal for educational content and narration.",
    sampleText: "Today we explore the fascinating intersection of technology and human creativity.",
    engine: "edge"
  },
  {
    id: "en-IN-PrabhatNeural",
    name: "Prabhat",
    gender: "male",
    traits: ["Indian", "Professional", "News"],
    description: "Professional Indian English male voice — great for news reading and formal presentations.",
    sampleText: "The quarterly report shows significant growth across all key performance indicators.",
    engine: "edge"
  },
  {
    id: "ja-JP-NanamiNeural",
    name: "Nanami",
    gender: "female",
    traits: ["Japanese", "Polite", "Gentle"],
    description: "Polite and gentle Japanese female voice — perfect for Japanese narration and storytelling.",
    sampleText: "こんにちは。今日は素晴らしい一日になりそうです。",  
    engine: "edge"
  },
  {
    id: "fr-FR-DeniseNeural",
    name: "Denise",
    gender: "female",
    traits: ["French", "Elegant", "Warm"],
    description: "Elegant French female voice — ideal for French narration and cultural content.",
    sampleText: "Bienvenue dans ce nouvel épisode. Aujourd'hui, nous allons explorer un sujet fascinant.",
    engine: "edge"
  },
  {
    id: "es-ES-ElviraNeural",
    name: "Elvira",
    gender: "female",
    traits: ["Spanish", "Clear", "Professional"],
    description: "Clear and professional Spanish female voice — great for Spanish narration and broadcasts.",
    sampleText: "Bienvenidos al noticiero de hoy. Comenzamos con las últimas noticias del día.",
    engine: "edge"
  },
  {
    id: "de-DE-KatjaNeural",
    name: "Katja",
    gender: "female",
    traits: ["German", "Clear", "Professional"],
    description: "Clear and professional German female voice — ideal for German narration and presentations.",
    sampleText: "Willkommen bei heute's Zusammenfassung. Lassen Sie uns mit den wichtigsten Themen beginnen.",
    engine: "edge"
  }
];



export const STYLE_OPTIONS = [
  { value: "", label: "Maintain current style" },
  { value: "Professional Documentary Narrator", label: "Documentary Narrator (Polished)" },
  { value: "Excited Radio Host / Advertisement", label: "Radio Host (High Energy)" },
  { value: "Soothing Yoga / Meditation Instructor", label: "Meditation Guide (Slower, Peaceful)" },
  { value: "Enthusiastic Tech Presenter", label: "Tech Keynote (Inspirational)" },
  { value: "Whimsical Children's Storyteller", label: "Kids Storyteller (Engaging, Animated)" },
  { value: "Friendly & Helpful AI Assistant", label: "Virtual Assistant (Clear, direct)" }
];

export const LANGUAGE_OPTIONS = [
  { value: "original", label: "Original Language" },
  { value: "English", label: "English" },
  { value: "Spanish (Español)", label: "Spanish (Español)" },
  { value: "French (Français)", label: "French (Français)" },
  { value: "German (Deutsch)", label: "German (Deutsch)" },
  { value: "Japanese (日本語)", label: "Japanese (日本語)" },
  { value: "Italian (Italiano)", label: "Italian (Italiano)" },
  { value: "Portuguese (Português)", label: "Portuguese (Português)" }
];
