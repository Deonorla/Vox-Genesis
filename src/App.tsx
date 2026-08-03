import React, { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Clock, 
  History, 
  HelpCircle, 
  FileText, 
  ChevronRight, 
  Check, 
  Languages, 
  Plus, 
  ArrowRight,
  Music,
  Maximize2,
  ListRestart,
  VolumeX,
  User,
  Info,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Voice, GeneratedAudio, PresetText } from "./types";
import { PRESETS, EDGE_TTS_VOICES } from "./data";
import { getAudioUrlFromBase64, downloadAudioFromBase64 } from "./utils";
import StoryStudio from "./components/StoryStudio";
import VoiceCloneStudio from "./components/VoiceCloneStudio";

export default function App() {
  // Main states
  const [activeTab, setActiveTab] = useState<"script" | "story" | "clone">("story"); // Default to the premium Story Architect requested!
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<Voice>(EDGE_TTS_VOICES.find(v => v.id === "en-US-BrianNeural")!);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const allVoices = [...EDGE_TTS_VOICES, ...customVoices.filter(v => v.isCloned)];

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <div className="min-h-screen bg-[#050505] text-[#D1D1D1] font-sans antialiased selection:bg-indigo-500/25 selection:text-indigo-200">
      
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
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#080808] text-white text-sm px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-zinc-800"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-950 text-red-200 text-sm px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2 max-w-md border border-red-900/40"
          >
            <div className="text-white p-1 rounded-full bg-red-900/50">
              <Info className="w-4 h-4 text-red-400" />
            </div>
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Grid */}
      <header className="border-b border-zinc-800 bg-[#080808] sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Volume2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-base font-display font-bold tracking-tight text-white uppercase tracking-wider">Vox·Genesis</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Edge TTS Speech Suite</p>
            </div>
          </div>

          {/* Desktop Controls - Hidden on Mobile */}
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-zinc-600 font-mono hidden md:block">
              UTC: 2026-06-26
            </div>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            title="Open Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sm:hidden fixed top-16 left-0 right-0 z-40 bg-[#080808] border-b border-zinc-800 shadow-2xl"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              {/* Navigation Tabs */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Navigation</p>
                <button
                  onClick={() => {
                    setActiveTab("story");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === "story"
                      ? "bg-indigo-500/10 border border-indigo-500/30 text-white"
                      : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold">Story Architect</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("script");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === "script"
                      ? "bg-indigo-500/10 border border-indigo-500/30 text-white"
                      : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-semibold">Script Studio</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("clone");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === "clone"
                      ? "bg-pink-500/10 border border-pink-500/30 text-white"
                      : "bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <User className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-semibold">Voice Clone Studio</span>
                </button>
              </div>

              {/* UTC Time */}
              <div className="text-[10px] text-zinc-600 font-mono">
                UTC: {new Date().toISOString().split('T')[0]}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs - Desktop Only */}
        <div className="hidden sm:flex border-b border-zinc-800 mb-8 gap-6">
          <button
            onClick={() => setActiveTab("story")}
            className={`pb-4 px-1 text-xs font-mono uppercase tracking-widest border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === "story"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Story Architect
          </button>
          <button
            onClick={() => setActiveTab("script")}
            className={`pb-4 px-1 text-xs font-mono uppercase tracking-widest border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === "script"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <FileText className="w-4 h-4 text-zinc-400" />
            Script Studio
          </button>
          <button
            onClick={() => setActiveTab("clone")}
            className={`pb-4 px-1 text-xs font-mono uppercase tracking-widest border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === "clone"
                ? "border-pink-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <User className="w-4 h-4 text-pink-400" />
            Voice Clone Studio
          </button>
        </div>

        {/* Mobile Active Tab Indicator */}
        <div className="sm:hidden mb-6">
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            {activeTab === "story" && <><Sparkles className="w-4 h-4 text-indigo-400" /><span className="text-sm font-semibold text-white">Story Architect</span></>}
            {activeTab === "script" && <><FileText className="w-4 h-4 text-zinc-400" /><span className="text-sm font-semibold text-white">Script Studio</span></>}
            {activeTab === "clone" && <><User className="w-4 h-4 text-pink-400" /><span className="text-sm font-semibold text-white">Voice Clone Studio</span></>}
            <span className="text-[10px] text-zinc-500 font-mono ml-auto">Tap ☰ to switch</span>
          </div>
        </div>

        {activeTab === "script" && (
          <>
            {/* Intro Hero Section */}
            <div className="mb-8">
              <h2 className="text-3xl sm:text-4xl font-serif italic text-white leading-tight">
                Convert Text to Natural Speech
              </h2>
              <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Leverage Microsoft Edge Neural TTS with 400+ premium voices across multiple languages. 
                Type your script, select a voice, and generate speech instantly.
              </p>
            </div>

            {/* Core Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT SIDE: SCRIPT WRITING */}
              <section className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Editor Workspace */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl shadow-sm overflow-hidden backdrop-blur-xs">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 bg-[#080808]/80">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                        Script Studio
                      </span>
                    </div>
                    
                    {/* Clear script option */}
                    {inputText && (
                      <button 
                        onClick={() => setInputText("")}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <ListRestart className="w-3.5 h-3.5" />
                        Reset Editor
                      </button>
                    )}
                  </div>

                  {/* Presets Row */}
                  <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none bg-[#080808]/40">
                    <span className="text-xs text-zinc-500 font-mono flex-none">Templates:</span>
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleLoadPreset(p)}
                        className="text-xs bg-zinc-900 hover:bg-indigo-500/10 hover:text-indigo-400 px-3 py-1.5 rounded-full text-zinc-400 font-medium transition-all flex-none border border-zinc-800 hover:border-indigo-500/30 cursor-pointer"
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>

                  {/* Text Area Input */}
                  <div className="relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Begin typing your manuscript here..."
                      rows={8}
                      className="w-full p-5 text-zinc-300 placeholder-zinc-650 focus:outline-none text-base leading-relaxed resize-y border-none bg-transparent"
                      maxLength={1000}
                    />
                    
                    {/* Character Counter */}
                    <div className="absolute bottom-3 right-4 font-mono text-[10px] text-zinc-500 bg-[#080808]/90 px-2 py-0.5 rounded border border-zinc-800">
                      {inputText.length} / 1000 CHARACTERS
                    </div>
                  </div>
                </div>

          </section>

          {/* RIGHT SIDE: VOICE CONTROLS, OUTPUT, HISTORIES */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            
            {/* VOICE SELECTION */}
            <div className="bg-[#080808] border border-zinc-800 rounded-2xl shadow-sm p-5">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 mb-4 font-mono">
                Voice Architecture
              </h3>

              <div className="flex flex-col gap-3">
                {allVoices.map((voice) => {
                  const isSelected = selectedVoice.id === voice.id;
                  const isTesting = testingVoiceId === voice.id;

                  return (
                    <div
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice)}
                      className={`group border rounded-xl p-4 transition-all cursor-pointer relative ${
                        isSelected 
                          ? "border-indigo-500/30 bg-indigo-500/10 text-white" 
                          : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-400"
                      }`}
                    >
                      {/* Flex header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isSelected ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                          }`}>
                            {voice.id.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-zinc-200"}`}>{voice.name}</span>
                              <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded font-bold tracking-wider ${
                                voice.gender === 'female' ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {voice.gender}
                              </span>
                            </div>
                            {/* Traits badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {voice.traits.map(t => (
                                <span key={t} className="text-[9px] bg-zinc-950 text-zinc-500 border border-zinc-800/60 px-1.5 py-0.5 rounded font-medium">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Listen preview button */}
                        <button
                          type="button"
                          disabled={isGenerating || testingVoiceId !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateTTS(voice.sampleText, voice.id, true);
                          }}
                          className={`text-[10px] px-2.5 py-1 rounded-md border font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                            isTesting 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                          }`}
                        >
                          {isTesting ? (
                            <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current" />
                          )}
                          Sample
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-zinc-550 leading-normal font-sans">
                        {voice.description}
                      </p>

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION GENERATION CARD */}
            <div className="bg-[#080808] border border-zinc-800 rounded-2xl p-5 shadow-sm">
              
              {/* Playback rate settings */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                    Playback Rate (Speed)
                  </label>
                  <span className="text-xs font-bold text-indigo-400 font-mono">{playbackSpeed.toFixed(2)}x</span>
                </div>
                <div className="flex gap-1.5">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        playbackSpeed === speed 
                          ? "bg-indigo-600 text-white border-indigo-650 font-semibold" 
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850"
                      }`}
                    >
                      {speed === 1.0 ? "Normal" : `${speed}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Button to generate */}
              <button
                onClick={() => handleGenerateTTS()}
                disabled={isGenerating || !inputText.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-widest shadow-lg shadow-indigo-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer uppercase font-mono text-center"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    SYNTHESIZING...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4.5 h-4.5" />
                    GENERATE SPEECH
                  </>
                )}
              </button>
            </div>

            {/* HIGH FIDELITY CUSTOM AUDIO PLAYER */}
            <div className="bg-[#080808] text-white border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3.5 pb-3.5 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                     <Music className="w-4 h-4 text-indigo-400" />
                     <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-zinc-550">
                       Active Master Output
                     </span>
                  </div>

                  {activeAudio && (
                     <button
                       onClick={() => {
                         const isEdge = EDGE_TTS_VOICES.some(v => v.name === activeAudio.voiceName);
                         downloadAudioFromBase64(activeAudio.audioContent, `${activeAudio.voiceName}_speech.${isEdge ? "mp3" : "wav"}`);
                       }}
                       className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer"
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
                      <h4 className="text-sm font-bold text-white truncate max-w-full">
                        {activeAudio.title}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wider">
                        Voice: {activeAudio.voiceName} • {activeAudio.timestamp.split(" - ")[0]}
                      </p>
                    </div>

                    {/* Simple dynamic wave bar visualizer */}
                    <div className="h-12 flex items-end justify-center gap-[2.5px] bg-[#050505] rounded-xl px-4 py-2.5 mb-4 border border-zinc-800">
                      {Array.from({ length: 26 }).map((_, i) => {
                        // Generate a pseudo-random animation duration
                        const randDuration = 0.5 + Math.random() * 0.8;
                        return (
                          <div
                            key={i}
                            style={{
                              animationDuration: isPlaying ? `${randDuration}s` : '0s',
                              height: isPlaying ? `${15 + Math.random() * 25}px` : '4px'
                            }}
                            className={`w-1 rounded-full transition-all ${
                              isPlaying ? "animate-wave-bar origin-bottom bg-indigo-500" : "bg-zinc-800"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Progress seeking timeline bar */}
                    <div className="flex items-center gap-3.5 mb-4">
                      <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.01"
                        value={currentTime}
                        onChange={handleSeekChange}
                        className="flex-1 accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono w-8">
                        {formatTime(duration)}
                      </span>
                    </div>

                    {/* Primary play controllers */}
                    <div className="flex items-center justify-center gap-5">
                      <button
                        onClick={toggleMute}
                        className="p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-12 h-12 rounded-full bg-white hover:bg-zinc-100 hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition-all cursor-pointer"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current text-black" />
                        ) : (
                          <Play className="w-5 h-5 fill-current text-black ml-0.5" />
                        )}
                      </button>

                      <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono px-2 py-1 rounded font-bold">
                        {playbackSpeed.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-zinc-600 flex flex-col items-center justify-center">
                    <Volume2 className="w-8 h-8 text-zinc-800 mb-2 animate-pulse" />
                    <p className="text-xs">No active track generated yet</p>
                    <p className="text-[10px] text-zinc-700 mt-1">Input text and click Synthesize Speech above</p>
                  </div>
                )}
              </div>
            </div>

            {/* SAVED VAULT (HISTORY) */}
            <div className="bg-[#080808] border border-zinc-800 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2 text-zinc-300">
                  <History className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono">
                    Synthesized Vault
                  </h3>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      saveHistory([]);
                      showSuccessNotification("Vault cleared.");
                    }}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition-all font-medium cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {history.map((item) => {
                    const isActive = activeAudio?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleLoadFromHistory(item)}
                        className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isActive 
                            ? "border-indigo-500/30 bg-indigo-500/10" 
                            : "border-zinc-800 bg-[#050505]/60 hover:border-zinc-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-200 truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono font-medium">
                              Voice: {item.voiceName}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {item.timestamp.split(" - ")[0]}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Play state visual */}
                          {isActive && isPlaying ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                          ) : null}

                          <button
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
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
                <div className="py-6 text-center text-zinc-600 text-xs">
                  Your vault is currently empty. Generated files appear here for easy playback and download.
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

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-[#080808] mt-16 py-8 text-center text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 VoxGenesis Speech Generator. Powered by Microsoft Edge Neural TTS.</p>
        </div>
      </footer>
    </div>
  );
}
