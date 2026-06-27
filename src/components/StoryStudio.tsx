import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Download, 
  Scissors, 
  Volume2, 
  VolumeX, 
  History, 
  GripVertical, 
  ChevronRight, 
  Search, 
  Edit3, 
  Check, 
  Loader2, 
  X, 
  Music, 
  ZoomIn, 
  ZoomOut,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Story, StoryBlock, Voice } from "../types";
import { VOICES } from "../data";
import { 
  getAudioUrlFromBase64, 
  decodeBase64ToAudioBuffer, 
  trimAndMergeAudioBuffers, 
  audioBufferToWav 
} from "../utils";

interface StoryStudioProps {
  allVoices?: Voice[];
  onNotify: (msg: string, isError?: boolean) => void;
}

const DEFAULT_STORY_SEEDS: Story[] = [
  {
    id: "story_1",
    title: "You Earned More. You Built Nothing.",
    updatedAt: new Date().toLocaleDateString(),
    blocks: [
      {
        id: "block_1_1",
        text: "Your thirty.",
        voiceId: "en-US-BrianNeural",
        voiceName: "Brian",
        trimStart: 0,
        trimEnd: 0
      },
      {
        id: "block_1_2",
        text: "You make seventy-eight thousand dollars a year. Your account sits at fifty-five.",
        voiceId: "en-US-AriaNeural",
        voiceName: "Aria",
        trimStart: 0,
        trimEnd: 0
      },
      {
        id: "block_1_3",
        text: "The account sits at fifty-five. Payday is four days out. You have three thousand four hundred dollars on a card you have been paying the minimum on since march.",
        voiceId: "en-US-BrianNeural",
        voiceName: "Brian",
        trimStart: 0,
        trimEnd: 0
      }
    ]
  },
  {
    id: "story_2",
    title: "The Whispering Squirrel",
    updatedAt: new Date().toLocaleDateString(),
    blocks: [
      {
        id: "block_2_1",
        text: "Deep in the ancient Whispering Woods, there lived a tiny, adventurous squirrel named Pip.",
        voiceId: "en-US-AvaNeural",
        voiceName: "Ava",
        trimStart: 0,
        trimEnd: 0
      },
      {
        id: "block_2_2",
        text: "Unlike the other squirrels who only collected dry acorns, Pip collected stories.",
        voiceId: "en-US-BrianNeural",
        voiceName: "Brian",
        trimStart: 0,
        trimEnd: 0
      },
      {
        id: "block_2_3",
        text: "And tonight, he was about to discover the most magical story of all.",
        voiceId: "en-US-GuyNeural",
        voiceName: "Guy",
        trimStart: 0,
        trimEnd: 0
      }
    ]
  }
];

export default function StoryStudio({ allVoices = VOICES, onNotify }: StoryStudioProps) {
  // Stories storage state
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");

  // Timeline & Playback States
  const [isSynthesizingBlockId, setIsSynthesizingBlockId] = useState<string | null>(null);
  const [isSynthesizingAll, setIsSynthesizingAll] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  
  // Decoded audio buffers cache to allow fast, fully local scrubbing, trimming and playback!
  const [decodedBuffers, setDecodedBuffers] = useState<Record<string, AudioBuffer>>({});
  
  // Timeline playback state
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(false);
  const [timelineDuration, setTimelineDuration] = useState(0);
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [zoomFactor, setZoomFactor] = useState<number>(30); // pixels per second
  const [activeTrimBlockId, setActiveTrimBlockId] = useState<string | null>(null);

  // Drag & drop sorting
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Audio elements references
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackPausedAtRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  // Load and seed stories on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tts_stories");
      if (stored) {
        const parsed = JSON.parse(stored);
        setStories(parsed);
        if (parsed.length > 0) {
          setActiveStoryId(parsed[0].id);
        }
      } else {
        localStorage.setItem("tts_stories", JSON.stringify(DEFAULT_STORY_SEEDS));
        setStories(DEFAULT_STORY_SEEDS);
        setActiveStoryId(DEFAULT_STORY_SEEDS[0].id);
      }
    } catch (e) {
      console.error("Failed to load stories", e);
    }
  }, []);

  // Save stories helper
  const saveStoriesToStorage = (updatedStories: Story[]) => {
    setStories(updatedStories);
    try {
      localStorage.setItem("tts_stories", JSON.stringify(updatedStories));
    } catch (e) {
      console.error("Failed to save stories", e);
    }
  };

  const activeStory = stories.find(s => s.id === activeStoryId);

  // Handle active story change - stop playback and cache decodes
  useEffect(() => {
    stopGlobalPlayback();
    setTimelineCurrentTime(0);
    setActiveTrimBlockId(null);
    
    if (activeStory) {
      setRenameTitle(activeStory.title);
      // Pre-load / decode any base64 buffers that exist
      decodeStoryAudioBuffers(activeStory);
    }
  }, [activeStoryId]);

  // Lazy instantiate AudioContext
  const getAudioCtx = (): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Decode existing audio content helper
  const decodeStoryAudioBuffers = async (story: Story) => {
    const audioCtx = getAudioCtx();
    const newDecoded: Record<string, AudioBuffer> = { ...decodedBuffers };
    let hasNewDecode = false;

    for (const block of story.blocks) {
      if (block.audioContent && !decodedBuffers[block.id]) {
        try {
          const buffer = await decodeBase64ToAudioBuffer(block.audioContent, audioCtx);
          newDecoded[block.id] = buffer;
          hasNewDecode = true;
        } catch (err) {
          console.error(`Error decoding block ${block.id}`, err);
        }
      }
    }

    if (hasNewDecode) {
      setDecodedBuffers(newDecoded);
    }
  };

  // Recalculate timeline length and block offsets based on active trim ranges
  useEffect(() => {
    if (!activeStory) {
      setTimelineDuration(0);
      return;
    }

    let total = 0;
    activeStory.blocks.forEach(block => {
      const buffer = decodedBuffers[block.id];
      const origDuration = buffer ? buffer.duration : (block.duration || 0);
      
      const tStart = block.trimStart;
      const tEnd = block.trimEnd || origDuration;
      
      const duration = tEnd > tStart ? tEnd - tStart : origDuration;
      total += duration;
    });

    setTimelineDuration(total);
  }, [activeStory, decodedBuffers]);

  // Decode a single newly generated block buffer
  const cacheSingleBuffer = async (blockId: string, base64: string) => {
    try {
      const audioCtx = getAudioCtx();
      const buffer = await decodeBase64ToAudioBuffer(base64, audioCtx);
      setDecodedBuffers(prev => ({
        ...prev,
        [blockId]: buffer
      }));
      return buffer;
    } catch (err) {
      console.error("Failed to decode base64 buffer", err);
      return null;
    }
  };

  // Create new story
  const handleCreateStory = () => {
    const newStory: Story = {
      id: "story_" + Date.now(),
      title: "Untitled Story",
      updatedAt: new Date().toLocaleDateString(),
      blocks: [
        {
          id: "block_" + Date.now() + "_1",
          text: "Once upon a time in a silent virtual environment...",
          voiceId: "Kore",
          voiceName: "Kore",
          trimStart: 0,
          trimEnd: 0
        }
      ]
    };

    const updated = [newStory, ...stories];
    saveStoriesToStorage(updated);
    setActiveStoryId(newStory.id);
    setIsRenaming(true);
    onNotify("Created a new story outline. Begin typing your script blocks.");
  };

  // Delete a story
  const handleDeleteStory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = stories.filter(s => s.id !== id);
    saveStoriesToStorage(updated);
    onNotify("Story deleted from workspace.");
    
    if (activeStoryId === id) {
      if (updated.length > 0) {
        setActiveStoryId(updated[0].id);
      } else {
        setActiveStoryId("");
      }
    }
  };

  // Rename a story
  const handleRenameStory = () => {
    if (!renameTitle.trim() || !activeStory) return;
    
    const updated = stories.map(s => {
      if (s.id === activeStory.id) {
        return {
          ...s,
          title: renameTitle.trim(),
          updatedAt: new Date().toLocaleDateString()
        };
      }
      return s;
    });

    saveStoriesToStorage(updated);
    setIsRenaming(false);
    onNotify("Story title updated.");
  };

  // Add block to current story
  const handleAddBlock = () => {
    if (!activeStory) return;

    const newBlock: StoryBlock = {
      id: "block_" + Date.now(),
      text: "",
      voiceId: "Kore",
      voiceName: "Kore",
      trimStart: 0,
      trimEnd: 0
    };

    const updatedBlocks = [...activeStory.blocks, newBlock];
    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: updatedBlocks, updatedAt: new Date().toLocaleDateString() };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
    onNotify("Added a new sequence block to the story.");
  };

  // Update specific block field
  const handleUpdateBlock = (blockId: string, fields: Partial<StoryBlock>) => {
    if (!activeStory) return;

    const updatedBlocks = activeStory.blocks.map(b => {
      if (b.id === blockId) {
        const res = { ...b, ...fields };
        // Reset trims if audio changes entirely
        if (fields.audioContent) {
          res.trimStart = 0;
          res.trimEnd = fields.duration || 0;
        }
        return res;
      }
      return b;
    });

    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: updatedBlocks };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
  };

  // Delete a block from current story
  const handleDeleteBlock = (blockId: string) => {
    if (!activeStory) return;
    if (activeStory.blocks.length <= 1) {
      onNotify("Stories must have at least one speech block.", true);
      return;
    }

    // Clean decoded cache
    const newDecoded = { ...decodedBuffers };
    delete newDecoded[blockId];
    setDecodedBuffers(newDecoded);

    const updatedBlocks = activeStory.blocks.filter(b => b.id !== blockId);
    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: updatedBlocks };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
    onNotify("Block removed.");
  };

  // Generate speech for a single block
  const handleGenerateBlockSpeech = async (block: StoryBlock) => {
    if (!block.text.trim()) {
      onNotify("Please provide text for this script block.", true);
      return;
    }

    setIsSynthesizingBlockId(block.id);
    stopGlobalPlayback();

    try {
      const voiceObj = allVoices.find(v => v.id === block.voiceId);
      const voiceEngine = voiceObj?.engine || "gemini";
      const apiVoiceName = voiceObj?.isCloned ? (voiceObj.baseVoiceId || "Kore") : block.voiceId;

      const apiEndpoint = voiceEngine === "edge" ? "/api/edge-tts" : "/api/tts";
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: block.text,
          voiceName: apiVoiceName
        })
      });

      if (!res.ok) {
        let errMsg = "Generation failed";
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      const base64 = data.audioContent;
      
      // Decodes and caches in memory
      const decoded = await cacheSingleBuffer(block.id, base64);
      const calculatedDuration = decoded ? decoded.duration : 0.0;

      // Update the story model
      handleUpdateBlock(block.id, {
        audioContent: base64,
        duration: calculatedDuration,
        trimStart: 0,
        trimEnd: calculatedDuration
      });

      onNotify(`Voice synthesized for block segment using ${block.voiceName}!`);
    } catch (err: any) {
      onNotify(err.message || "Failed to synthesize speech.", true);
    } finally {
      setIsSynthesizingBlockId(null);
    }
  };

  // Synthesize all blocks that are currently unsynthesized or modified
  const handleSynthesizeAll = async () => {
    if (!activeStory) return;
    
    const unsynthesized = activeStory.blocks.filter(b => !b.audioContent && b.text.trim());
    if (unsynthesized.length === 0) {
      onNotify("All active text blocks already have synthesized voice clips.");
      return;
    }

    setIsSynthesizingAll(true);
    onNotify(`Synthesizing ${unsynthesized.length} segments sequentially...`);

    for (const block of unsynthesized) {
      await handleGenerateBlockSpeech(block);
    }

    setIsSynthesizingAll(false);
    onNotify("All segments successfully synthesized.");
  };

  // Native HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !activeStory) return;

    const blocksCopy = [...activeStory.blocks];
    const [draggedBlock] = blocksCopy.splice(draggedIndex, 1);
    blocksCopy.splice(targetIndex, 0, draggedBlock);

    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: blocksCopy, updatedAt: new Date().toLocaleDateString() };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
    setDraggedIndex(null);
    onNotify("Script block order updated.");
  };

  // Move block up
  const handleMoveUp = (index: number) => {
    if (index === 0 || !activeStory) return;
    const blocksCopy = [...activeStory.blocks];
    const temp = blocksCopy[index];
    blocksCopy[index] = blocksCopy[index - 1];
    blocksCopy[index - 1] = temp;
    
    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: blocksCopy };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
  };

  // Move block down
  const handleMoveDown = (index: number) => {
    if (!activeStory || index === activeStory.blocks.length - 1) return;
    const blocksCopy = [...activeStory.blocks];
    const temp = blocksCopy[index];
    blocksCopy[index] = blocksCopy[index + 1];
    blocksCopy[index + 1] = temp;

    const updatedStories = stories.map(s => {
      if (s.id === activeStory.id) {
        return { ...s, blocks: blocksCopy };
      }
      return s;
    });

    saveStoriesToStorage(updatedStories);
  };

  // Play a single block locally (trimmed)
  const [playingBlockId, setPlayingBlockId] = useState<string | null>(null);
  const localSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handlePlayBlockClip = (block: StoryBlock) => {
    const buffer = decodedBuffers[block.id];
    if (!buffer) {
      handleGenerateBlockSpeech(block);
      return;
    }

    if (playingBlockId === block.id) {
      if (localSourceRef.current) {
        localSourceRef.current.stop();
      }
      setPlayingBlockId(null);
      return;
    }

    // Stop existing local plays
    if (localSourceRef.current) {
      localSourceRef.current.stop();
    }
    stopGlobalPlayback();

    const audioCtx = getAudioCtx();
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    const tStart = block.trimStart || 0;
    const tEnd = block.trimEnd || buffer.duration;
    const duration = tEnd - tStart;

    source.start(0, tStart, duration);
    setPlayingBlockId(block.id);
    localSourceRef.current = source;

    source.onended = () => {
      setPlayingBlockId(null);
    };
  };

  // High Fidelity Real-time Audio Merging & Global Playback Controls
  const buildMergedBuffer = (): AudioBuffer | null => {
    if (!activeStory) return null;
    
    const blocksToMerge: { audioBuffer: AudioBuffer; trimStart: number; trimEnd: number }[] = [];
    
    for (const block of activeStory.blocks) {
      const buffer = decodedBuffers[block.id];
      if (!buffer) {
        // Missing audio segment
        return null;
      }
      blocksToMerge.push({
        audioBuffer: buffer,
        trimStart: block.trimStart || 0,
        trimEnd: block.trimEnd || buffer.duration
      });
    }

    if (blocksToMerge.length === 0) return null;

    try {
      return trimAndMergeAudioBuffers(blocksToMerge, getAudioCtx());
    } catch (e) {
      console.error("Failed to merge buffers", e);
      return null;
    }
  };

  // Play the entire story sequentially on the visual timeline
  const startGlobalPlayback = () => {
    if (isGlobalPlaying) {
      pauseGlobalPlayback();
      return;
    }

    const merged = buildMergedBuffer();
    if (!merged) {
      onNotify("Some segments need to be synthesized first.", true);
      return;
    }

    const audioCtx = getAudioCtx();
    
    // Create source node
    const source = audioCtx.createBufferSource();
    source.buffer = merged;
    source.connect(audioCtx.destination);

    const startTimeOffset = timelineCurrentTime >= timelineDuration ? 0 : timelineCurrentTime;
    
    source.start(0, startTimeOffset);
    activeSourceNodeRef.current = source;
    
    playbackStartTimeRef.current = audioCtx.currentTime - startTimeOffset;
    setIsGlobalPlaying(true);
    setPlayingBlockId(null);

    // Stop local plays if any
    if (localSourceRef.current) {
      localSourceRef.current.stop();
      setPlayingBlockId(null);
    }

    // Animation frames to tick progress cursor
    const tick = () => {
      if (!activeSourceNodeRef.current) return;
      const elapsed = audioCtx.currentTime - playbackStartTimeRef.current;
      
      if (elapsed >= timelineDuration) {
        setTimelineCurrentTime(0);
        setIsGlobalPlaying(false);
        activeSourceNodeRef.current = null;
      } else {
        setTimelineCurrentTime(elapsed);
        animationFrameIdRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(tick);

    source.onended = () => {
      // Clean up if it naturally ended
      if (activeSourceNodeRef.current === source) {
        setIsGlobalPlaying(false);
        setTimelineCurrentTime(0);
        activeSourceNodeRef.current = null;
      }
    };
  };

  const pauseGlobalPlayback = () => {
    if (activeSourceNodeRef.current) {
      activeSourceNodeRef.current.stop();
      activeSourceNodeRef.current = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    setIsGlobalPlaying(false);
  };

  const stopGlobalPlayback = () => {
    pauseGlobalPlayback();
    setTimelineCurrentTime(0);
  };

  // Seek globally on click on the timeline track
  const handleTimelineScrub = (time: number) => {
    const scrubbedTime = Math.max(0, Math.min(time, timelineDuration));
    
    if (isGlobalPlaying) {
      // Stop and restart from the new time
      stopGlobalPlayback();
      setTimelineCurrentTime(scrubbedTime);
      setTimeout(() => {
        const merged = buildMergedBuffer();
        if (merged) {
          const audioCtx = getAudioCtx();
          const source = audioCtx.createBufferSource();
          source.buffer = merged;
          source.connect(audioCtx.destination);
          source.start(0, scrubbedTime);
          activeSourceNodeRef.current = source;
          playbackStartTimeRef.current = audioCtx.currentTime - scrubbedTime;
          setIsGlobalPlaying(true);
          
          const tick = () => {
            if (!activeSourceNodeRef.current) return;
            const elapsed = audioCtx.currentTime - playbackStartTimeRef.current;
            if (elapsed >= timelineDuration) {
              setTimelineCurrentTime(0);
              setIsGlobalPlaying(false);
              activeSourceNodeRef.current = null;
            } else {
              setTimelineCurrentTime(elapsed);
              animationFrameIdRef.current = requestAnimationFrame(tick);
            }
          };
          animationFrameIdRef.current = requestAnimationFrame(tick);
        }
      }, 50);
    } else {
      setTimelineCurrentTime(scrubbedTime);
    }
  };

  // Export Story Audio to standard WAV file for download
  const handleExportMergedAudio = async () => {
    const merged = buildMergedBuffer();
    if (!merged) {
      onNotify("Please synthesize all story blocks before exporting.", true);
      return;
    }

    setIsMerging(true);
    onNotify("Merging audio streams and injecting headers...");

    setTimeout(() => {
      try {
        const wavBlob = audioBufferToWav(merged);
        const url = URL.createObjectURL(wavBlob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `${activeStory ? activeStory.title.toLowerCase().replace(/[^a-z0-9]/g, "_") : "story"}_master.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        onNotify("HQ Audio exported and downloaded successfully!");
      } catch (err: any) {
        onNotify("Failed to export audio file.", true);
      } finally {
        setIsMerging(false);
      }
    }, 800);
  };

  // Compute block position ranges for visual rendering in the timeline
  const getTimelineSegments = () => {
    if (!activeStory) return [];
    
    let currentStart = 0;
    return activeStory.blocks.map(block => {
      const buffer = decodedBuffers[block.id];
      const origDuration = buffer ? buffer.duration : (block.duration || 0);
      
      const tStart = block.trimStart;
      const tEnd = block.trimEnd || origDuration;
      const activeDuration = tEnd > tStart ? tEnd - tStart : origDuration;
      
      const res = {
        blockId: block.id,
        voiceName: block.voiceName,
        text: block.text,
        start: currentStart,
        duration: activeDuration,
        origDuration: origDuration,
        isTrimmed: tStart > 0 || (block.trimEnd > 0 && block.trimEnd < origDuration)
      };
      
      currentStart += activeDuration;
      return res;
    });
  };

  const segments = getTimelineSegments();

  // Search filtered stories
  const filteredStories = stories.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.blocks.some(b => b.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-140px)] pb-36">
      
      {/* LEFT SIDEBAR: STORIES INDEX */}
      <div className="lg:col-span-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Story Manuscripts
          </h2>
          <button
            onClick={handleCreateStory}
            className="p-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
            title="Create New Story"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#050505] border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Stories Listing */}
        <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-[500px] space-y-2 pr-1 scrollbar-thin">
          {filteredStories.map((story) => {
            const isActive = story.id === activeStoryId;
            return (
              <div
                key={story.id}
                onClick={() => setActiveStoryId(story.id)}
                className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isActive
                    ? "border-indigo-500/40 bg-indigo-500/10 text-white"
                    : "border-zinc-900 bg-[#080808]/40 hover:border-zinc-800 hover:bg-[#080808] text-zinc-400"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold truncate group-hover:text-white transition-colors">
                    {story.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                      {story.blocks.length} {story.blocks.length === 1 ? 'segment' : 'segments'}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-mono">
                      {story.updatedAt}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteStory(story.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                  title="Delete Story"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {filteredStories.length === 0 && (
            <div className="py-8 text-center text-zinc-600 text-xs">
              No stories match your search.
            </div>
          )}
        </div>
      </div>

      {/* CENTER & MAIN SEQUENCER WORKSPACE */}
      <div className="lg:col-span-9 flex flex-col gap-6">
        
        {/* STORY HEADER PANEL */}
        {activeStory ? (
          <div className="bg-[#080808] border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isRenaming ? (
                  <div className="flex items-center gap-2 max-w-xl">
                    <input
                      type="text"
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameStory()}
                      className="bg-zinc-900 border border-indigo-500/40 text-sm font-bold rounded-xl px-3 py-1.5 text-white w-full focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleRenameStory}
                      className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsRenaming(false);
                        setRenameTitle(activeStory.title);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-serif italic text-white truncate">
                      {activeStory.title}
                    </h1>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
                      title="Rename Story"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">
                  Story Mode • {activeStory.blocks.length} speech components configured
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddBlock}
                  className="text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add segment
                </button>
                <button
                  onClick={handleSynthesizeAll}
                  disabled={isSynthesizingAll}
                  className="text-xs bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
                >
                  {isSynthesizingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Synthesize All
                </button>
                <button
                  onClick={handleExportMergedAudio}
                  disabled={isMerging}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/10 hover:scale-[1.01] disabled:opacity-50 cursor-pointer uppercase font-mono tracking-wider"
                >
                  {isMerging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Audio
                </button>
              </div>
            </div>

            {/* BLOCK CARDS LIST */}
            <div className="space-y-4">
              {activeStory.blocks.map((block, index) => {
                const buffer = decodedBuffers[block.id];
                const hasAudio = !!block.audioContent && !!buffer;
                const isTesting = playingBlockId === block.id;
                const isSynthesizing = isSynthesizingBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`bg-zinc-900/30 border rounded-2xl p-4 transition-all flex flex-col md:flex-row gap-4 items-start ${
                      draggedIndex === index
                        ? "border-dashed border-indigo-500 bg-indigo-500/5 opacity-50"
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/20"
                    }`}
                  >
                    
                    {/* Drag Handle & Ordering controls */}
                    <div className="flex md:flex-col items-center gap-2 self-stretch justify-between md:justify-center border-b md:border-b-0 md:border-r border-zinc-800/80 pb-3 md:pb-0 md:pr-4">
                      <div className="flex items-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 p-1 rounded hover:bg-zinc-900">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Direction Arrow overrides */}
                      <div className="flex md:flex-col gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-30 cursor-pointer"
                          title="Move Segment Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === activeStory.blocks.length - 1}
                          className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-30 cursor-pointer"
                          title="Move Segment Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Block Configuration Content */}
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400">
                            <Volume2 className="w-3.5 h-3.5" />
                          </div>
                          <select
                            value={block.voiceId}
                            onChange={(e) => {
                              const v = allVoices.find(v => v.id === e.target.value);
                              if (v) {
                                handleUpdateBlock(block.id, { voiceId: v.id, voiceName: v.name });
                              }
                            }}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 font-medium focus:outline-none cursor-pointer"
                          >
                            {allVoices.map(v => (
                              <option key={v.id} value={v.id} className="bg-zinc-950 text-zinc-300">
                                {v.name} ({v.gender === "female" ? "F" : "M"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Speech Clip Stats */}
                        <div className="flex items-center gap-2">
                          {hasAudio ? (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Duration: {buffer.duration.toFixed(1)}s 
                              {block.trimEnd && block.trimEnd < buffer.duration ? ` (Trimmed to ${(block.trimEnd - block.trimStart).toFixed(1)}s)` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">
                              No voice generated yet
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                            title="Delete Clip segment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Text Input Block */}
                      <textarea
                        value={block.text}
                        onChange={(e) => handleUpdateBlock(block.id, { text: e.target.value })}
                        placeholder="Type narration or dialog for this voice track..."
                        rows={2}
                        className="w-full bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 resize-y"
                      />

                      {/* Trimming & Visual Wave cutting Panel */}
                      {hasAudio && (
                        <div className="border border-zinc-850 bg-[#050505]/40 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                              Visual Wave Cut / Segment Trimming
                            </span>
                            <button
                              onClick={() => handleUpdateBlock(block.id, { trimStart: 0, trimEnd: buffer.duration })}
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              Reset Slices
                            </button>
                          </div>

                          {/* Interactive Trim Dual Sliders */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <div className="flex justify-between text-[9px] font-mono text-zinc-500 mb-1">
                                <span>Trim start:</span>
                                <span>{block.trimStart.toFixed(2)}s</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max={buffer.duration}
                                step="0.05"
                                value={block.trimStart}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateBlock(block.id, { 
                                    trimStart: Math.min(val, block.trimEnd - 0.1) 
                                  });
                                }}
                                className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[9px] font-mono text-zinc-500 mb-1">
                                <span>Trim end:</span>
                                <span>{(block.trimEnd || buffer.duration).toFixed(2)}s</span>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max={buffer.duration}
                                step="0.05"
                                value={block.trimEnd || buffer.duration}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateBlock(block.id, { 
                                    trimEnd: Math.max(val, block.trimStart + 0.1) 
                                  });
                                }}
                                className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* Waveform Slicing Preview Visualizer */}
                          <div className="h-6 bg-[#030303] rounded border border-zinc-900 relative overflow-hidden flex items-center">
                            {/* Trim region visual overlay */}
                            <div 
                              className="absolute h-full bg-zinc-900 border-r border-zinc-800"
                              style={{ width: `${(block.trimStart / buffer.duration) * 100}%` }}
                            />
                            <div 
                              className="absolute h-full bg-zinc-900 border-l border-zinc-800"
                              style={{ 
                                left: `${((block.trimEnd || buffer.duration) / buffer.duration) * 100}%`,
                                right: 0
                              }}
                            />
                            
                            {/* Simulated waveform bars */}
                            <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none opacity-45">
                              {Array.from({ length: 40 }).map((_, i) => {
                                const active = (i / 40) >= (block.trimStart / buffer.duration) && (i / 40) <= ((block.trimEnd || buffer.duration) / buffer.duration);
                                return (
                                  <div
                                    key={i}
                                    style={{ height: `${20 + Math.sin(i * 0.4) * 50}%` }}
                                    className={`w-[2px] rounded-full ${active ? "bg-indigo-400" : "bg-zinc-800"}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Play & Synthesize controls */}
                    <div className="flex md:flex-col items-stretch gap-2 w-full md:w-32 self-stretch justify-center md:border-l border-zinc-800/80 md:pl-4">
                      {isSynthesizing ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs font-mono py-2 bg-zinc-900/65 rounded-xl border border-zinc-800">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mb-1" />
                          <span>Rendering...</span>
                        </div>
                      ) : hasAudio ? (
                        <>
                          <button
                            onClick={() => handlePlayBlockClip(block)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                              isTesting
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10"
                                : "bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800"
                            }`}
                          >
                            {isTesting ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current text-indigo-400" />
                                Listen
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleGenerateBlockSpeech(block)}
                            className="py-1.5 text-[10px] text-zinc-500 hover:text-indigo-400 font-mono flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGenerateBlockSpeech(block)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Synthesize
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-[#080808] border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center">
            <Music className="w-12 h-12 text-zinc-800 mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-white mb-1">No Story Active</h3>
            <p className="text-sm text-zinc-650 max-w-sm">
              Create a new story manuscript or select an existing outline from the sidebar to begin crafting multi-voice narratives.
            </p>
            <button
              onClick={handleCreateStory}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              + Create Manuscript
            </button>
          </div>
        )}

        {/* BOTTOM MASTER TIMELINE VIEW & PLAYBACK BAR */}
        {activeStory && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#060606]/95 border-t border-zinc-800 p-4 sm:p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.8)] backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex flex-col gap-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] uppercase font-bold font-mono tracking-wider text-zinc-400">
                  Master Multi-Voice Output Timeline
                </span>
              </div>
              
              {/* Zoom slider */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-zinc-500 font-mono">Zoom:</span>
                <button 
                  onClick={() => setZoomFactor(prev => Math.max(10, prev - 5))}
                  className="p-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={zoomFactor}
                  onChange={(e) => setZoomFactor(parseInt(e.target.value))}
                  className="w-16 accent-indigo-500 h-1 bg-zinc-800 rounded"
                />
                <button 
                  onClick={() => setZoomFactor(prev => Math.min(80, prev + 5))}
                  className="p-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TIMELINE TRACK */}
            <div className="relative bg-[#050505] border border-zinc-850 rounded-xl h-24 overflow-x-auto overflow-y-hidden scrollbar-thin select-none">
              
              {/* Actual timeline scroll window container */}
              <div 
                className="relative h-full"
                style={{ width: `${Math.max(400, timelineDuration * zoomFactor + 40)}px` }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left - 20; // 20px padding start
                  const clickTime = clickX / zoomFactor;
                  handleTimelineScrub(clickTime);
                }}
              >
                {/* 20px leading timeline spacing */}
                <div className="absolute left-0 top-0 bottom-0 w-5 bg-zinc-950/20" />

                {/* Timeline time rule markings */}
                <div className="absolute left-5 right-5 top-0 h-4 border-b border-zinc-900 flex items-end">
                  {Array.from({ length: Math.ceil(timelineDuration) + 2 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute bottom-0 border-l border-zinc-800 text-[8px] text-zinc-600 font-mono pl-1"
                      style={{ 
                        left: `${i * zoomFactor}px`,
                        height: i % 5 === 0 ? "8px" : "4px" 
                      }}
                    >
                      {i % 5 === 0 ? `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, "0")}` : ""}
                    </div>
                  ))}
                </div>

                {/* SEGMENTS TRACK RAIL */}
                <div className="absolute left-5 top-6 bottom-0 right-5 flex items-stretch py-2.5">
                  {segments.map((segment, idx) => {
                    const isPlayingSegment = timelineCurrentTime >= segment.start && timelineCurrentTime < (segment.start + segment.duration);
                    return (
                      <div
                        key={segment.blockId}
                        style={{ width: `${segment.duration * zoomFactor}px` }}
                        className={`h-full border-r border-zinc-950 flex flex-col justify-between p-2 relative overflow-hidden transition-all ${
                          isPlayingSegment
                            ? "bg-indigo-600/20 border-y border-indigo-500/30"
                            : segment.isTrimmed
                            ? "bg-zinc-900/40 border-y border-zinc-900/50"
                            : "bg-zinc-900/80 border-y border-zinc-850/30"
                        }`}
                      >
                        {/* Segment Voice Name & Index */}
                        <div className="flex items-center justify-between relative z-10">
                          <span className={`text-[9px] font-bold truncate ${isPlayingSegment ? "text-indigo-300" : "text-zinc-400"}`}>
                            {idx + 1}. {segment.voiceName}
                          </span>
                          <span className="text-[8px] font-mono text-zinc-600">
                            {segment.duration.toFixed(1)}s
                          </span>
                        </div>

                        {/* Segment Text preview snippet */}
                        <p className="text-[8px] text-zinc-500 truncate relative z-10">
                          {segment.text || "Empty speech block"}
                        </p>

                        {/* Trim visual indicator: if trimmed, render small tag */}
                        {segment.isTrimmed && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" title="Trimming applied" />
                        )}

                        {/* Waveform graphic inside block segment */}
                        <div className="absolute bottom-1.5 left-2 right-2 h-2 flex items-end gap-[1px] pointer-events-none opacity-20">
                          {Array.from({ length: Math.ceil(segment.duration * 3) }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`flex-1 rounded-full ${isPlayingSegment ? "bg-indigo-400" : "bg-zinc-600"}`}
                              style={{ height: `${20 + (i % 3 === 0 ? 80 : i % 2 === 0 ? 50 : 30)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {segments.length === 0 && (
                    <div className="w-full flex items-center justify-center text-xs text-zinc-600">
                      Synthesize story segments to visualize track waves
                    </div>
                  )}
                </div>

                {/* SCROLLING YELLOW PLAYBACK PROGRESS CURSOR */}
                {timelineDuration > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-20 pointer-events-none"
                    style={{ 
                      left: `${20 + timelineCurrentTime * zoomFactor}px` 
                    }}
                  >
                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full -translate-x-[4px] shadow" />
                  </div>
                )}

              </div>
            </div>

            {/* TIMELINE CONTROLS BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#050505] border border-zinc-850 rounded-xl px-4 py-3">
              
              {/* Play / Pause / stop and time indicators */}
              <div className="flex items-center gap-3">
                <button
                  onClick={startGlobalPlayback}
                  className="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-150 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title={isGlobalPlaying ? "Pause Sequencer" : "Play Sequencer"}
                >
                  {isGlobalPlaying ? (
                    <Pause className="w-4.5 h-4.5 fill-current text-black" />
                  ) : (
                    <Play className="w-4.5 h-4.5 fill-current text-black ml-0.5" />
                  )}
                </button>

                <button
                  onClick={stopGlobalPlayback}
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Stop Playback"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Time displays */}
                <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 pl-2">
                  <span className="text-white font-bold">
                    {Math.floor(timelineCurrentTime / 60)}:{(timelineCurrentTime % 60).toFixed(1).toString().padStart(4, "0")}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-500">
                    {Math.floor(timelineDuration / 60)}:{(timelineDuration % 60).toFixed(1).toString().padStart(4, "0")}
                  </span>
                </div>
              </div>

              {/* Status updates */}
              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider hidden md:block">
                {isGlobalPlaying ? "Playing Master Feed..." : "Master Sequencer Ready"}
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddBlock}
                  className="text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:scale-[1.01] cursor-pointer"
                  title="Add new segment to story"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Segment
                </button>
                <button
                  onClick={handleExportMergedAudio}
                  disabled={isMerging}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/10 hover:scale-[1.01] disabled:opacity-50 cursor-pointer font-mono tracking-wider"
                  title="Export merged audio as WAV"
                >
                  {isMerging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export
                </button>
              </div>

              {/* Master Volume Indicator mock */}
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                <div className="w-20 bg-zinc-800 h-1 rounded overflow-hidden">
                  <div className="bg-indigo-500 h-full w-[80%]" />
                </div>
                <span className="text-[10px] font-mono text-zinc-500">80%</span>
              </div>

            </div>

          </div>
          </div>
        )}

      </div>

    </div>
  );
}
