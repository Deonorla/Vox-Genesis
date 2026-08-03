import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Volume2, 
  Plus, 
  Check, 
  User, 
  VolumeX,
  FileAudio,
  AlertCircle
} from "lucide-react";
import { Voice } from "../types";
import { EDGE_TTS_VOICES } from "../data";

interface VoiceCloneStudioProps {
  customVoices: Voice[];
  onAddVoice: (voice: Voice) => void;
  onDeleteVoice: (id: string) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export default function VoiceCloneStudio({
  customVoices,
  onAddVoice,
  onDeleteVoice,
  onNotify
}: VoiceCloneStudioProps) {
  // Form states
  const [voiceName, setVoiceName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [baseVoiceId, setBaseVoiceId] = useState("Kore");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState<string[]>(["Cloned", "Custom"]);
  const [newTrait, setNewTrait] = useState("");

  // Audio Upload/Record states
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isCloning, setIsCloning] = useState(false);

  // Playback state for uploaded/recorded reference audio
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  // Clean up timer and playback on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
      }
    };
  }, []);

  // Synchronize base voice selection when gender changes to prevent mismatch
  useEffect(() => {
    const defaultVoiceForGender = EDGE_TTS_VOICES.find(v => v.gender === gender);
    if (defaultVoiceForGender) {
      setBaseVoiceId(defaultVoiceForGender.id);
    }
  }, [gender]);

  // Format recording timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const base64 = await convertBlobToBase64(audioBlob);
        setAudioBase64(base64);
        setAudioFileName("Live Recording Voice Sample");
        onNotify("Voice sample recorded successfully.");
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access failed", err);
      onNotify("Failed to access microphone. Please check permissions.", true);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      onNotify("File is too large. Please select a sample under 15MB.", true);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAudioBase64(reader.result as string);
      setAudioFileName(file.name);
      onNotify("Voice sample uploaded successfully.");
    };
    reader.onerror = () => {
      onNotify("Failed to read voice file.", true);
    };
    reader.readAsDataURL(file);
  };

  // Convert blob to base64 string
  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Play dynamic voice sample reference
  const handlePlaySample = (voice: Voice) => {
    if (!voice.sampleAudio) return;

    if (playingVoiceId === voice.id) {
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
    }

    const audio = new Audio(voice.sampleAudio);
    audioPlaybackRef.current = audio;
    setPlayingVoiceId(voice.id);
    audio.play().catch(e => {
      console.error("Failed to play sample", e);
      setPlayingVoiceId(null);
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // Play uploaded unsaved reference
  const handlePlayUnsavedSample = () => {
    if (!audioBase64) return;

    if (playingVoiceId === "unsaved") {
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
    }

    const audio = new Audio(audioBase64);
    audioPlaybackRef.current = audio;
    setPlayingVoiceId("unsaved");
    audio.play().catch(e => {
      console.error("Failed to play sample", e);
      setPlayingVoiceId(null);
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // Add trait
  const handleAddTrait = () => {
    if (newTrait.trim() && !traits.includes(newTrait.trim())) {
      setTraits([...traits, newTrait.trim()]);
      setNewTrait("");
    }
  };

  // Remove trait
  const handleRemoveTrait = (trait: string) => {
    setTraits(traits.filter(t => t !== trait));
  };

  // Submit Voice Cloning
  const handleCloneVoice = () => {
    if (!voiceName.trim()) {
      onNotify("Please provide a name for your cloned voice.", true);
      return;
    }
    if (!audioBase64) {
      onNotify("Please upload an audio file or record a voice sample to clone.", true);
      return;
    }

    setIsCloning(true);
    onNotify("Initiating acoustic cloning engine...");

    // Simulate AI extraction step
    setTimeout(() => {
      const newVoice: Voice = {
        id: "clone_" + Date.now(),
        name: voiceName,
        gender: gender,
        traits: traits.length > 0 ? traits : ["Cloned", "Premium"],
        description: description.trim() || `Cloned voice signature matched to ${baseVoiceId} base print.`,
        sampleText: "This is a custom voice print mapped to my unique biological frequency.",
        isCloned: true,
        baseVoiceId: baseVoiceId,
        sampleAudio: audioBase64
      };

      onAddVoice(newVoice);
      setIsCloning(false);
      onNotify(`Voice successfully cloned as "${voiceName}"! Ready for production.`);

      // Reset form
      setVoiceName("");
      setDescription("");
      setTraits(["Cloned", "Custom"]);
      setAudioBase64(null);
      setAudioFileName(null);
    }, 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LEFT SIDE: CREATOR PANEL */}
      <section className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-[#080808] border border-zinc-800 rounded-2xl shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -z-0 opacity-40 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              <h2 className="text-xl font-serif italic text-white leading-tight">
                Register Custom Voice Signature
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed mb-6">
              Create a synthetic voice model from any clear vocal recording. Select a base voice to match gender, frequency range, and tone, then generate speech using your custom cloned profile.
            </p>

            <div className="space-y-5">
              
              {/* Voice Name */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                  Voice Profile Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Private Podcast Vocal"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full bg-[#040404] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/40"
                />
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Gender */}
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                    Biological Model Gender
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGender("female")}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                        gender === "female"
                          ? "bg-pink-500/10 border-pink-500/40 text-pink-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Female Tone
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("male")}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                        gender === "male"
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Male Tone
                    </button>
                  </div>
                </div>

                {/* Base Acoustic Carrier Profile */}
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                    Acoustic Carrier Profile
                  </label>
                  <select
                    value={baseVoiceId}
                    onChange={(e) => setBaseVoiceId(e.target.value)}
                    className="w-full bg-[#040404] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/40 cursor-pointer"
                  >
                    {EDGE_TTS_VOICES.filter(v => v.gender === gender).map(v => (
                      <option key={v.id} value={v.id} className="bg-zinc-950 text-zinc-300">
                        {v.name} Base ({v.traits.slice(0, 2).join(", ")})
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Sample Recording & Upload Workspace */}
              <div className="bg-[#040404] border border-zinc-850 rounded-2xl p-4">
                <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
                  Biological Vocal Input Source
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Option 1: Live Record */}
                  <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/40 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Mic className={`w-4 h-4 ${isRecording ? "text-red-500 animate-pulse" : "text-zinc-400"}`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300">Live Voice Record</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">Speak into your mic for 5-10 seconds</p>
                    </div>

                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="text-xs font-semibold bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Stop ({formatTime(recordDuration)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-300 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5 text-pink-400" />
                        Record Audio
                      </button>
                    )}
                  </div>

                  {/* Option 2: Upload audio */}
                  <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/40 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300">Acoustic File Upload</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">WAV, MP3, or M4A file under 15MB</p>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="audio/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-300 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-pink-400" />
                      Upload WAV/MP3
                    </button>
                  </div>

                </div>

                {/* Display Loaded Sample */}
                {audioBase64 && (
                  <div className="mt-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio className="w-4 h-4 text-pink-400 flex-none" />
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-zinc-300 truncate">
                          {audioFileName}
                        </span>
                        <span className="block text-[9px] text-zinc-500 font-mono uppercase">
                          Acoustic Print Loaded
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePlayUnsavedSample}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          playingVoiceId === "unsaved"
                            ? "bg-pink-600 border-pink-500 text-white"
                            : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                        }`}
                        title="Play Sample Voice"
                      >
                        {playingVoiceId === "unsaved" ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioBase64(null);
                          setAudioFileName(null);
                          onNotify("Voice sample cleared.");
                        }}
                        className="p-1.5 rounded-lg border border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-red-400 cursor-pointer"
                        title="Clear Sample"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags/Traits Customizer */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                  Acoustic Descriptor Tags
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {traits.map(t => (
                    <span 
                      key={t} 
                      className="text-xs bg-zinc-900 border border-zinc-800/80 rounded-full px-3 py-1 flex items-center gap-1.5 text-zinc-400 font-medium"
                    >
                      {t}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTrait(t)}
                        className="text-[10px] text-zinc-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Crisp, Deep, Husky"
                    value={newTrait}
                    onChange={(e) => setNewTrait(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTrait())}
                    className="flex-1 bg-[#040404] border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/40"
                  />
                  <button
                    type="button"
                    onClick={handleAddTrait}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium rounded-xl px-4 text-xs cursor-pointer"
                  >
                    Add tag
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                  Voice Profile Description
                </label>
                <textarea
                  placeholder="Describe the context or unique qualities of this cloned vocal identity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#040404] border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/40 resize-y"
                />
              </div>

              {/* Submit Trigger */}
              <button
                type="button"
                onClick={handleCloneVoice}
                disabled={isCloning}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-pink-500/10 cursor-pointer uppercase font-mono tracking-wider"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Synthesizing Neural Vocal Signatures...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Clone Voice Print
                  </>
                )}
              </button>

            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE: VAULT / COLLECTION */}
      <section className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#080808] border border-zinc-800 rounded-2xl shadow-sm p-5 min-h-[400px] flex flex-col">
          <h3 className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 mb-4 font-mono">
            Cloned Voices Vault ({customVoices.length})
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[550px] scrollbar-thin">
            {customVoices.map((voice) => {
              const isPlaying = playingVoiceId === voice.id;
              return (
                <div
                  key={voice.id}
                  className="border border-pink-500/10 bg-pink-500/[0.02] hover:border-pink-500/20 rounded-xl p-4 transition-all relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center text-xs font-bold font-mono">
                        {voice.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate max-w-[120px] sm:max-w-none">
                            {voice.name}
                          </span>
                          <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded font-bold tracking-wider ${
                            voice.gender === 'female' ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {voice.gender}
                          </span>
                          <span className="text-[8px] font-mono text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                            Base: {voice.baseVoiceId}
                          </span>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {voice.traits.map(t => (
                            <span key={t} className="text-[9px] bg-zinc-950 text-zinc-500 border border-zinc-850 px-1.5 py-0.5 rounded font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-none">
                      <button
                        type="button"
                        onClick={() => handlePlaySample(voice)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isPlaying
                            ? "bg-pink-600 border-pink-500 text-white"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                        title="Listen to original sample vocal"
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteVoice(voice.id)}
                        className="p-1.5 rounded-lg border border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete dynamic voice profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-zinc-450 leading-relaxed italic bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/40">
                    &ldquo;{voice.description}&rdquo;
                  </p>
                </div>
              );
            })}

            {customVoices.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20 py-16">
                <Mic className="w-8 h-8 text-zinc-700 mb-2.5 animate-pulse" />
                <h4 className="text-xs font-bold text-zinc-450 mb-1">Your Voice Vault is Empty</h4>
                <p className="text-[10px] text-zinc-650 max-w-xs">
                  Speak or upload an audio sample to extract and clone custom voice prints that you can immediately use inside Script Studio and Story Architect.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
