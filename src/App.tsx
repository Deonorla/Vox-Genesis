import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Sparkles,
  Play,
  Pause,
  Download,
  Trash2,
  History,
  FileText,
  Check,
  Music,
  VolumeX,
  User,
  ChevronDown,
  Loader2,
  ListRestart,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Voice, GeneratedAudio, PresetText } from "./types";
import { PRESETS, EDGE_TTS_VOICES } from "./data";
import { getAudioUrlFromBase64, downloadAudioFromBase64 } from "./utils";
import StoryStudio from "./components/StoryStudio";
import VoiceCloneStudio from "./components/VoiceCloneStudio";
import LandingPage, { Session } from "./components/LandingPage";

/** Join class names, dropping falsy values. */
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const TABS = [
  { id: "story" as const, label: "Story Architect", short: "Story", icon: Sparkles },
  { id: "script" as const, label: "Script Studio", short: "Script", icon: FileText },
  { id: "clone" as const, label: "Voice Clone Studio", short: "Clone", icon: User },
];

export default function App() {
  // Main states
  const [activeTab, setActiveTab] = useState<"script" | "story" | "clone">("story"); // Default to the premium Story Architect requested!
  const [inputText, setInputText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<Voice>(EDGE_TTS_VOICES.find(v => v.id === "en-US-BrianNeural")!);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Header / picker presentation states
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  // Audio Player states
  const [activeAudio, setActiveAudio] = useState<GeneratedAudio | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // History & Storage states
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Session (localStorage only — no backend/database)
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem("vox_session");
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (s: Session) => {
    try {
      localStorage.setItem("vox_session", JSON.stringify(s));
    } catch (e) {
      console.error("Failed to save session", e);
    }
    setSession(s);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("vox_session");
    } catch (e) {
      console.error("Failed to clear session", e);
    }
    setSession(null);
    setActiveTab("story");
    window.scrollTo({ top: 0 });
  };

  const allVoices = [...EDGE_TTS_VOICES, ...customVoices.filter(v => v.isCloned)];

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track header scroll state (hairline + blur once the page moves)
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load history and custom voices from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tts_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to read local storage history", e);
    }

    try {
      const storedVoices = localStorage.getItem("custom_voices");
      if (storedVoices) {
        setCustomVoices(JSON.parse(storedVoices));
      }
    } catch (e) {
      console.error("Failed to read custom voices", e);
    }
  }, []);

  const handleAddCustomVoice = (voice: Voice) => {
    const updated = [voice, ...customVoices];
    setCustomVoices(updated);
    try {
      localStorage.setItem("custom_voices", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save custom voices", e);
    }
  };

  const handleDeleteCustomVoice = (id: string) => {
    const updated = customVoices.filter(v => v.id !== id);
    setCustomVoices(updated);
    try {
      localStorage.setItem("custom_voices", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save custom voices", e);
    }
    if (selectedVoice.id === id) {
      setSelectedVoice(EDGE_TTS_VOICES[0]);
    }
  };

  // Save history to local storage when updated
  const saveHistory = (updated: GeneratedAudio[]) => {
    setHistory(updated);
    try {
      localStorage.setItem("tts_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save to local storage", e);
    }
  };

  // Synchronize playback speed with HTML audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, activeAudioUrl]);

  // Track playback state changes
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((err) => {
          console.error("Audio playback interrupted", err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, activeAudioUrl]);

  // Load sample / presets
  const handleLoadPreset = (preset: PresetText) => {
    setInputText(preset.text);
    showSuccessNotification(`Loaded "${preset.title}" preset`);
  };

  // Helper notification managers
  const showSuccessNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showErrorNotification = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Generate main TTS
  const handleGenerateTTS = async (textToGenerate?: string, targetVoiceId?: string, isSampleTest = false) => {
    const text = textToGenerate || inputText;
    const voiceId = targetVoiceId || selectedVoice.id;

    if (!text.trim()) {
      showErrorNotification("Please input some text to speak.");
      return;
    }

    if (isSampleTest) {
      setTestingVoiceId(voiceId);
    } else {
      setIsGenerating(true);
    }
    setErrorMsg(null);

    const selectedVoiceObj = allVoices.find(v => v.id === voiceId);
    const apiVoiceName = selectedVoiceObj?.isCloned ? (selectedVoiceObj.baseVoiceId || "en-US-BrianNeural") : voiceId;

    try {
      const apiEndpoint = "/api/edge-tts";
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voiceName: apiVoiceName,
        }),
      });

      if (!res.ok) {
        let errMsg = "Speech generation failed";
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!data.audioContent) {
        throw new Error("No audio content returned from speech engine.");
      }

      const newAudioItem: GeneratedAudio = {
        id: "tts_" + Date.now(),
        title: isSampleTest ? `Voice Preview: ${selectedVoiceObj?.name || voiceId}` : `Audio Speech (${selectedVoiceObj?.name || voiceId})`,
        text: text,
        voiceName: selectedVoiceObj?.name || voiceId,
        audioContent: data.audioContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + new Date().toLocaleDateString(),
      };

      // Convert and play
      const blobUrl = getAudioUrlFromBase64(data.audioContent);
      setActiveAudio(newAudioItem);
      setActiveAudioUrl(blobUrl);
      setIsPlaying(true);
      setCurrentTime(0);

      // Only add to history if it's NOT a quick sample preview test
      if (!isSampleTest) {
        const updatedHistory = [newAudioItem, ...history.slice(0, 9)]; // Keep max 10
        saveHistory(updatedHistory);
        showSuccessNotification("Speech synthesized beautifully!");
      } else {
        showSuccessNotification(`Playing voice preview for ${voiceId}`);
      }

    } catch (err: any) {
      console.error(err);
      showErrorNotification(err.message || "Failed to generate speech. Verify server setup.");
    } finally {
      setIsGenerating(false);
      setTestingVoiceId(null);
    }
  };

  // Load audio from history list
  const handleLoadFromHistory = (item: GeneratedAudio) => {
    const blobUrl = getAudioUrlFromBase64(item.audioContent);
    setActiveAudio(item);
    setActiveAudioUrl(blobUrl);
    setIsPlaying(true);
    setCurrentTime(0);
    showSuccessNotification(`Playing "${item.title}"`);
  };

  // Delete history item
  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
    if (activeAudio?.id === id) {
      setActiveAudio(null);
      setActiveAudioUrl(null);
      setIsPlaying(false);
    }
    showSuccessNotification("Audio deleted from your vault.");
  };

  // Audio HTML elements event binders
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (activeAudio && !activeAudio.duration) {
        // save duration to state
        const updated = history.map(item => {
          if (item.id === activeAudio.id) {
            return { ...item, duration: audioRef.current?.duration };
          }
          return item;
        });
        setHistory(updated);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Format seconds to standard MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const selectedVoiceObj = allVoices.find(v => v.id === selectedVoice.id) || selectedVoice;

  // Gate: no local session → landing page with login
  if (!session) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-cream text-ink font-sans antialiased">

      {/* Hidden audio element for logic */}
      {activeAudioUrl && (
        <audio
          ref={audioRef}
          src={activeAudioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
        />
      )}

      {/* Floating Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[60] bg-white border border-ink/10 rounded-full shadow-xl shadow-ink/10 px-4 py-2.5 flex items-center gap-2.5 max-w-[92vw] sm:max-w-md"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs font-semibold text-ink truncate">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[60] bg-white border border-rose-dark/30 rounded-2xl shadow-xl shadow-ink/10 px-4 py-3 flex items-center gap-2.5 max-w-[92vw] sm:max-w-md"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-xs font-semibold text-ink leading-snug">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className={cx(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-cream/95 backdrop-blur-xl border-b border-ink/8 shadow-sm"
            : "bg-cream/80 backdrop-blur-md border-b border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              setActiveTab("story");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 group shrink-0"
          >
            <span className="w-8 h-8 rounded-full bg-ink text-cream flex items-center justify-center shadow-lg shadow-ink/15 group-hover:bg-gold transition-colors">
              <Volume2 className="w-4 h-4" />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="font-display font-black text-[13px] sm:text-sm tracking-[0.18em] uppercase text-ink">
                Vox·Genesis
              </span>
              <span className="text-[8px] sm:text-[9px] font-black tracking-[0.35em] uppercase text-ink/40 mt-1">
                Speech Suite
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-ink/8 rounded-full px-3 py-1.5 text-[9px] font-black tracking-[0.2em] uppercase text-ink/50">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Edge Neural TTS
            </span>
            {session && (
              <span className="hidden lg:inline-flex items-center gap-2 bg-white border border-ink/8 rounded-full pl-1.5 pr-3 py-1">
                <span className="w-6 h-6 rounded-full bg-gold text-cream flex items-center justify-center font-display font-black text-[11px]">
                  {session.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[10px] font-bold text-ink/65 max-w-[110px] truncate">
                  {session.name}
                </span>
              </span>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-rose-dark hover:border-ink/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16">

        {/* Desktop tab rail */}
        <div className="hidden sm:flex items-end justify-between border-b border-ink/8 mb-8 gap-6">
          <div className="flex gap-6 lg:gap-8">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "pb-4 px-1 text-[10px] font-black uppercase tracking-[0.25em] border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    isActive
                      ? "border-ink text-ink"
                      : "border-transparent text-ink/35 hover:text-ink/75"
                  )}
                >
                  <Icon className={cx("w-3.5 h-3.5", isActive ? "text-gold" : "")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span className="pb-4 text-[9px] font-black tracking-[0.25em] uppercase text-ink/25 hidden lg:block">
            Multi-voice studio · 400+ neural voices
          </span>
        </div>

        {/* Mobile segmented tabs (sticky under header) */}
        <div className="sm:hidden sticky top-14 z-40 -mx-4 px-4 pt-3 pb-2.5 bg-cream/95 backdrop-blur-xl border-b border-ink/8 mb-6">
          <div className="grid grid-cols-3 gap-1.5 bg-cream-dark/80 border border-ink/8 rounded-full p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[9px] font-black tracking-[0.14em] uppercase transition-all cursor-pointer",
                    isActive
                      ? "bg-ink text-cream shadow-md shadow-ink/15"
                      : "text-ink/45 hover:text-ink"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.short}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "script" && (
              <>
                {/* Editorial hero */}
                <div className="mb-8 sm:mb-10 max-w-3xl">
                  <p className="text-[10px] font-black tracking-[0.4em] uppercase text-gold mb-3">
                    Script Studio
                  </p>
                  <h1 className="font-display font-black text-ink leading-[0.95] tracking-tight text-[clamp(2rem,5.5vw,3.5rem)]">
                    Convert text into{" "}
                    <em className="italic text-gold">natural speech.</em>
                  </h1>
                  <p className="mt-4 text-sm sm:text-base text-ink/55 leading-relaxed max-w-xl">
                    Leverage Microsoft Edge Neural TTS with 400+ premium voices across multiple
                    languages. Type your script, pick a voice, and generate speech instantly.
                  </p>
                </div>

                {/* Core layout grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                  {/* LEFT: manuscript editor */}
                  <section className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-white border border-ink/5 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-ink/6 flex items-center justify-between gap-3 bg-cream-light/60">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-ink text-cream flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45">
                            Manuscript
                          </span>
                        </div>

                        {inputText && (
                          <button
                            onClick={() => setInputText("")}
                            className="text-[10px] font-black uppercase tracking-[0.15em] text-ink/40 hover:text-rose-dark transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <ListRestart className="w-3.5 h-3.5" />
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Preset templates rail */}
                      <div className="px-5 py-3 border-b border-ink/6 flex items-center gap-2 overflow-x-auto hide-scrollbar bg-cream-light/40">
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-ink/35 flex-none">
                          Templates:
                        </span>
                        {PRESETS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleLoadPreset(p)}
                            className="text-[10px] font-black uppercase tracking-[0.12em] bg-white hover:bg-ink hover:text-cream px-3.5 py-1.5 rounded-full text-ink/55 border border-ink/10 hover:border-ink transition-all flex-none cursor-pointer"
                          >
                            {p.title}
                          </button>
                        ))}
                      </div>

                      {/* Textarea */}
                      <div className="relative">
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Begin typing your manuscript here..."
                          rows={8}
                          className="w-full p-5 sm:p-6 text-ink placeholder-ink/25 focus:outline-none text-base leading-relaxed resize-y border-none bg-transparent"
                          maxLength={1000}
                        />
                        <div className="absolute bottom-3 right-4 font-mono text-[10px] text-ink/35 bg-white/90 px-2.5 py-1 rounded-full border border-ink/8">
                          {inputText.length} / 1000
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* RIGHT: voice, action, player, history */}
                  <section className="lg:col-span-5 flex flex-col gap-6">

                    {/* Voice architecture (collapsible picker) */}
                    <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45">
                          Voice Architecture
                        </h3>
                        <span className="font-mono text-[10px] text-ink/30">
                          {allVoices.length} voices
                        </span>
                      </div>

                      {/* Selected voice summary */}
                      <button
                        onClick={() => setIsVoicePickerOpen(v => !v)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-ink/10 bg-cream-light/70 hover:border-ink/25 transition-all text-left cursor-pointer"
                      >
                        <span className="w-10 h-10 rounded-xl bg-ink text-cream flex items-center justify-center font-display font-black text-sm shrink-0">
                          {selectedVoiceObj.name.charAt(0)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-sm text-ink truncate">
                              {selectedVoiceObj.name}
                            </span>
                            <span
                              className={cx(
                                "text-[8px] font-black uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full border",
                                selectedVoiceObj.gender === "female"
                                  ? "bg-rose/25 text-rose-dark border-rose/40"
                                  : "bg-ink/8 text-ink/60 border-ink/10"
                              )}
                            >
                              {selectedVoiceObj.gender}
                            </span>
                          </span>
                          <span className="block text-[10px] text-ink/40 font-medium truncate mt-0.5">
                            {selectedVoiceObj.traits.join(" · ")}
                          </span>
                        </span>
                        <ChevronDown
                          className={cx(
                            "w-4 h-4 text-ink/40 transition-transform shrink-0",
                            isVoicePickerOpen && "rotate-180"
                          )}
                        />
                      </button>

                      {/* Expanded voice list */}
                      <AnimatePresence initial={false}>
                        {isVoicePickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin pr-1">
                              {allVoices.map((voice) => {
                                const isSelected = selectedVoice.id === voice.id;
                                const isTesting = testingVoiceId === voice.id;

                                return (
                                  <div
                                    key={voice.id}
                                    onClick={() => setSelectedVoice(voice)}
                                    className={cx(
                                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                      isSelected
                                        ? "border-ink/25 bg-cream-light shadow-sm"
                                        : "border-ink/6 bg-white hover:border-ink/15 hover:bg-cream/60"
                                    )}
                                  >
                                    <span
                                      className={cx(
                                        "w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-xs shrink-0",
                                        isSelected ? "bg-ink text-cream" : "bg-cream-dark text-ink/45"
                                      )}
                                    >
                                      {voice.name.charAt(0)}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-display font-bold text-sm text-ink truncate">
                                          {voice.name}
                                        </span>
                                        <span
                                          className={cx(
                                            "text-[8px] font-black uppercase tracking-wider px-1.5 py-px rounded-full border",
                                            voice.gender === "female"
                                              ? "bg-rose/25 text-rose-dark border-rose/40"
                                              : "bg-ink/8 text-ink/60 border-ink/10"
                                          )}
                                        >
                                          {voice.gender}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {voice.traits.slice(0, 3).map(t => (
                                          <span key={t} className="text-[8px] font-black uppercase tracking-wider text-ink/35 bg-cream-dark px-1.5 py-0.5 rounded-full">
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={isGenerating || testingVoiceId !== null}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleGenerateTTS(voice.sampleText, voice.id, true);
                                      }}
                                      className={cx(
                                        "text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                        isTesting
                                          ? "bg-ink text-cream border-ink"
                                          : "bg-white text-ink/50 border-ink/10 hover:border-ink/30 hover:text-ink",
                                        (isGenerating || testingVoiceId !== null) && !isTesting && "opacity-40"
                                      )}
                                    >
                                      {isTesting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Play className="w-3 h-3 fill-current" />
                                      )}
                                      Sample
                                    </button>

                                    {isSelected && (
                                      <span className="w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Speed + generate */}
                    <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45">
                          Playback Rate
                        </label>
                        <span className="font-mono text-xs font-semibold text-gold">
                          {playbackSpeed.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex gap-1.5 mb-4">
                        {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={cx(
                              "flex-1 text-[11px] font-black py-2 rounded-full border text-center transition-all cursor-pointer",
                              playbackSpeed === speed
                                ? "bg-ink text-cream border-ink"
                                : "bg-white text-ink/45 border-ink/10 hover:border-ink/30 hover:text-ink"
                            )}
                          >
                            {speed === 1.0 ? "1x" : `${speed}x`}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => handleGenerateTTS()}
                        disabled={isGenerating || !inputText.trim()}
                        className="w-full bg-ink text-cream py-3.5 px-6 rounded-full font-black text-[11px] tracking-[0.25em] uppercase shadow-lg shadow-ink/10 hover:bg-rose hover:text-ink active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer text-center"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Synthesizing...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            Generate Speech
                          </>
                        )}
                      </button>
                    </div>

                    {/* Studio player */}
                    <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-5 relative overflow-hidden">
                      <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose/25 blur-3xl rounded-full pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-ink/8">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-gold" />
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-ink/45">
                              Active Master Output
                            </span>
                          </div>

                          {activeAudio && (
                            <button
                              onClick={() => {
                                const isEdge = EDGE_TTS_VOICES.some(v => v.name === activeAudio.voiceName);
                                downloadAudioFromBase64(activeAudio.audioContent, `${activeAudio.voiceName}_speech.${isEdge ? "mp3" : "wav"}`);
                              }}
                              className="text-gold text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 hover:text-rose-dark transition-colors cursor-pointer"
                              title="Download speech file"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download HQ
                            </button>
                          )}
                        </div>

                        {activeAudio ? (
                          <div>
                            {/* Track info */}
                            <div className="mb-4">
                              <h4 className="text-sm font-display font-bold text-ink truncate max-w-full">
                                {activeAudio.title}
                              </h4>
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-ink/40 mt-1 font-mono">
                                {activeAudio.voiceName} · {activeAudio.timestamp.split(" - ")[0]}
                              </p>
                            </div>

                            {/* Waveform visualizer */}
                            <div className="h-12 flex items-end justify-center gap-[2.5px] bg-cream-light rounded-xl px-4 py-2.5 mb-4 border border-ink/8">
                              {Array.from({ length: 26 }).map((_, i) => {
                                const randDuration = 0.5 + Math.random() * 0.8;
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      animationDuration: isPlaying ? `${randDuration}s` : '0s',
                                      height: isPlaying ? `${15 + Math.random() * 25}px` : '4px'
                                    }}
                                    className={cx(
                                      "w-1 rounded-full transition-all origin-bottom",
                                      isPlaying ? "animate-wave-bar bg-gold" : "bg-ink/15"
                                    )}
                                  />
                                );
                              })}
                            </div>

                            {/* Seek timeline */}
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-[10px] font-mono text-ink/40 w-9 text-right">
                                {formatTime(currentTime)}
                              </span>
                              <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                step="0.01"
                                value={currentTime}
                                onChange={handleSeekChange}
                                className="flex-1 accent-gold h-1 bg-ink/15 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-ink/40 w-9">
                                {formatTime(duration)}
                              </span>
                            </div>

                            {/* Transport controls */}
                            <div className="flex items-center justify-center gap-5">
                              <button
                                onClick={toggleMute}
                                className="p-2.5 text-ink/45 hover:text-ink transition-colors cursor-pointer"
                                title={isMuted ? "Unmute" : "Mute"}
                              >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="w-12 h-12 rounded-full bg-ink text-cream hover:bg-rose hover:text-ink flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer"
                              >
                                {isPlaying ? (
                                  <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                )}
                              </button>

                              <span className="text-[10px] font-mono font-bold text-ink/50 border border-ink/15 rounded-full px-2.5 py-1">
                                {playbackSpeed.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center flex flex-col items-center justify-center">
                            <Volume2 className="w-8 h-8 text-ink/15 mb-3" />
                            <p className="text-xs font-semibold text-ink/45">No active track generated yet</p>
                            <p className="text-[10px] text-ink/30 mt-1.5">
                              Input text and hit Generate Speech above
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Synthesized vault (history) */}
                    <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-ink/6">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-ink/35" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45">
                            Synthesized Vault
                          </h3>
                          {history.length > 0 && (
                            <span className="font-mono text-[9px] bg-cream-dark text-ink/45 px-1.5 py-0.5 rounded-full">
                              {history.length}
                            </span>
                          )}
                        </div>
                        {history.length > 0 && (
                          <button
                            onClick={() => {
                              saveHistory([]);
                              showSuccessNotification("Vault cleared.");
                            }}
                            className="text-[9px] font-black uppercase tracking-[0.15em] text-ink/35 hover:text-rose-dark transition-all cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {history.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                          {history.map((item) => {
                            const isActive = activeAudio?.id === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => handleLoadFromHistory(item)}
                                className={cx(
                                  "group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3",
                                  isActive
                                    ? "border-ink/20 bg-cream-light"
                                    : "border-ink/6 bg-white hover:border-ink/15 hover:bg-cream/60"
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-ink truncate">
                                    {item.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-ink/40 bg-cream-dark border border-ink/8 px-1.5 py-0.5 rounded-full truncate max-w-[110px]">
                                      {item.voiceName}
                                    </span>
                                    <span className="text-[9px] font-mono text-ink/30">
                                      {item.timestamp.split(" - ")[0]}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isActive && isPlaying ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-dark animate-ping" />
                                  ) : null}

                                  <button
                                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                                    className="text-ink/25 hover:text-red-500 p-2 rounded-full hover:bg-cream-dark transition-colors cursor-pointer"
                                    title="Delete file"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-ink/35 text-xs">
                          Your vault is currently empty. Generated files appear here for easy
                          playback and download.
                        </div>
                      )}
                    </div>

                  </section>
                </div>
              </>
            )}

            {activeTab === "story" && (
              <StoryStudio
                allVoices={allVoices}
                onNotify={(msg, isError) => isError ? showErrorNotification(msg) : showSuccessNotification(msg)}
              />
            )}

            {activeTab === "clone" && (
              <VoiceCloneStudio
                customVoices={customVoices}
                onAddVoice={handleAddCustomVoice}
                onDeleteVoice={handleDeleteCustomVoice}
                onNotify={(msg, isError) => isError ? showErrorNotification(msg) : showSuccessNotification(msg)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-cream-dark border-t border-ink/8 text-ink mt-16 sm:mt-24 pt-14 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-ink/8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center">
                  <Volume2 size={14} />
                </span>
                <span className="font-display text-xs font-black tracking-[0.2em] uppercase">
                  Vox·Genesis
                </span>
              </div>
              <p className="text-xs text-ink/45 leading-relaxed">
                Editorial-grade speech synthesis for scripts, stories, and custom voices.
              </p>
            </div>

            {/* Studios (functional) */}
            <div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase text-ink/40 mb-4">
                Studios
              </p>
              <ul className="space-y-2.5">
                {TABS.map(tab => (
                  <li key={tab.id}>
                    <button
                      onClick={() => {
                        setActiveTab(tab.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-xs text-ink/55 hover:text-ink transition-colors cursor-pointer"
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Engine */}
            <div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase text-ink/40 mb-4">
                Engine
              </p>
              <ul className="space-y-2.5 text-xs text-ink/55">
                <li>Edge Neural TTS</li>
                <li>Azure Speech fallback</li>
                <li>Web Audio merging</li>
              </ul>
            </div>

            {/* Formats */}
            <div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase text-ink/40 mb-4">
                Formats
              </p>
              <ul className="space-y-2.5 text-xs text-ink/55">
                <li>MP3 input · 24 kHz mono</li>
                <li>WAV master export</li>
                <li>Per-block trimming</li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-ink/35 text-center sm:text-left">
              © {new Date().getFullYear()} VoxGenesis Speech Generator
              {session ? ` · Signed in as ${session.name}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-dark" />
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-ink/40">
                Powered by Microsoft Edge Neural TTS
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
