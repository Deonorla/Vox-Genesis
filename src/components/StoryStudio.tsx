import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Download, 
  Scissors, 
  Volume2, 
  History, 
  GripVertical, 
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
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Story, StoryBlock, Voice } from "../types";
import { EDGE_TTS_VOICES } from "../data";
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

export default function StoryStudio({ allVoices = EDGE_TTS_VOICES, onNotify }: StoryStudioProps) {
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
      voiceId: "en-US-BrianNeural",
      voiceName: "Brian",
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
      const apiVoiceName = voiceObj?.isCloned ? (voiceObj.baseVoiceId || "en-US-BrianNeural") : block.voiceId;

      const apiEndpoint = "/api/edge-tts";
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-140px)] pb-64 sm:pb-48 lg:pb-44">
      
      {/* LEFT SIDEBAR: STORIES INDEX */}
      <div className="lg:col-span-3 bg-white border border-ink/5 rounded-2xl shadow-sm p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-gold" />
            Story Manuscripts
          </h2>
          <button
            onClick={handleCreateStory}
            className="flex items-center gap-1.5 bg-ink text-cream rounded-full text-[10px] font-black tracking-[0.2em] uppercase px-3.5 py-2.5 hover:bg-rose hover:text-ink transition-all active:scale-[0.98] cursor-pointer shrink-0"
            title="Create New Story"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cream/70 border border-ink/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/30 focus:bg-white transition-all"
          />
        </div>

        {/* Stories Listing — horizontal snap rail on mobile, vertical scroll list on desktop */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x lg:block lg:max-h-[520px] lg:overflow-y-auto lg:overflow-x-hidden lg:space-y-2 lg:scrollbar-thin">
          {filteredStories.map((story) => {
            const isActive = story.id === activeStoryId;
            return (
              <div
                key={story.id}
                onClick={() => setActiveStoryId(story.id)}
                className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 min-w-[240px] shrink-0 snap-start lg:min-w-0 lg:w-full ${
                  isActive
                    ? "border-ink/25 bg-cream-light shadow-sm"
                    : "border-ink/8 bg-white hover:border-ink/20 hover:bg-cream/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-ink truncate">
                    {story.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] bg-cream-dark text-ink/45 border border-ink/8 px-1.5 py-0.5 rounded-full">
                      {story.blocks.length} {story.blocks.length === 1 ? 'segment' : 'segments'}
                    </span>
                    <span className="text-[10px] font-mono text-ink/35">
                      {story.updatedAt}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteStory(story.id, e)}
                  className="p-2 rounded-full text-ink/30 hover:text-red-500 hover:bg-cream-dark transition-all cursor-pointer shrink-0 lg:opacity-0 lg:group-hover:opacity-100"
                  title="Delete Story"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {filteredStories.length === 0 && (
            <div className="py-8 text-center text-ink/35 text-xs lg:w-full">
              No stories match your search.
            </div>
          )}
        </div>
      </div>

      {/* CENTER & MAIN SEQUENCER WORKSPACE */}
      <div className="lg:col-span-9 flex flex-col gap-6">
        
        {/* STORY HEADER PANEL */}
        {activeStory ? (
          <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isRenaming ? (
                  <div className="flex items-center gap-2 max-w-xl">
                    <input
                      type="text"
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameStory()}
                      className="w-full bg-cream/70 border border-ink/10 rounded-full px-4 py-2.5 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/30 focus:bg-white transition-all"
                      autoFocus
                    />
                    <button
                      onClick={handleRenameStory}
                      className="w-9 h-9 rounded-full bg-ink text-cream flex items-center justify-center hover:bg-rose hover:text-ink transition-all active:scale-[0.98] cursor-pointer shrink-0"
                      title="Save Title"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsRenaming(false);
                        setRenameTitle(activeStory.title);
                      }}
                      className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-ink hover:border-ink/30 transition-all cursor-pointer shrink-0"
                      title="Cancel Rename"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-display font-black italic text-ink truncate">
                      {activeStory.title}
                    </h1>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-ink hover:border-ink/30 transition-all cursor-pointer shrink-0"
                      title="Rename Story"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 mt-2">
                  Story Mode • {activeStory.blocks.length} speech components configured
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddBlock}
                  className="bg-white border border-ink/10 text-ink/55 rounded-full text-[10px] font-black tracking-[0.15em] uppercase px-4 py-2.5 hover:border-ink/30 hover:text-ink transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add segment
                </button>
                <button
                  onClick={handleSynthesizeAll}
                  disabled={isSynthesizingAll}
                  className="bg-white border border-ink/10 text-ink/55 rounded-full text-[10px] font-black tracking-[0.15em] uppercase px-4 py-2.5 hover:border-ink/30 hover:text-ink transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
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
                  className="bg-ink text-cream rounded-full text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2.5 hover:bg-rose hover:text-ink transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
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
                    className={`bg-white border rounded-2xl p-4 transition-all flex flex-col md:flex-row gap-4 items-start shadow-sm ${
                      draggedIndex === index
                        ? "border-dashed border-gold bg-gold/5 opacity-50"
                        : "border-ink/10 hover:border-ink/25"
                    }`}
                  >
                    
                    {/* Drag Handle & Ordering controls */}
                    <div className="flex md:flex-col items-center gap-2 self-stretch justify-between md:justify-center border-b md:border-b-0 md:border-r border-ink/8 pb-3 md:pb-0 md:pr-4">
                      <div className="flex items-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-ink/35 hover:text-ink p-1.5 rounded-lg hover:bg-cream-dark transition-colors">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-ink/45 bg-cream-dark px-1.5 py-0.5 rounded-full border border-ink/8">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Direction Arrow overrides */}
                      <div className="flex md:flex-col gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-ink hover:border-ink/30 transition-all cursor-pointer disabled:opacity-30"
                          title="Move Segment Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === activeStory.blocks.length - 1}
                          className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-ink hover:border-ink/30 transition-all cursor-pointer disabled:opacity-30"
                          title="Move Segment Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Block Configuration Content */}
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-cream-dark border border-ink/8 flex items-center justify-center text-gold">
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
                            className="bg-white border border-ink/10 rounded-full px-3 py-2 text-xs text-ink focus:outline-none cursor-pointer"
                          >
                            {allVoices.map(v => (
                              <option key={v.id} value={v.id} className="bg-white text-ink">
                                {v.name} ({v.gender === "female" ? "F" : "M"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Speech Clip Stats */}
                        <div className="flex items-center gap-2">
                          {hasAudio ? (
                            <span className="text-[10px] font-mono text-ink/40">
                              Duration: {buffer.duration.toFixed(1)}s 
                              {block.trimEnd && block.trimEnd < buffer.duration ? ` (Trimmed to ${(block.trimEnd - block.trimStart).toFixed(1)}s)` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-ink/35">
                              No voice generated yet
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            className="w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-red-500 hover:border-red-200 transition-all cursor-pointer"
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
                        className="w-full bg-cream/70 border border-ink/10 rounded-2xl px-4 py-3 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/30 focus:bg-white transition-all resize-y"
                      />

                      {/* Trimming & Visual Wave cutting Panel */}
                      {hasAudio && (
                        <div className="border border-ink/5 bg-cream-light rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-ink/45">
                            <span className="flex items-center gap-1.5">
                              <Scissors className="w-3.5 h-3.5 text-gold" />
                              Visual Wave Cut / Segment Trimming
                            </span>
                            <button
                              onClick={() => handleUpdateBlock(block.id, { trimStart: 0, trimEnd: buffer.duration })}
                              className="text-[10px] font-black uppercase tracking-[0.15em] text-gold hover:text-ink transition-colors cursor-pointer shrink-0"
                            >
                              Reset Slices
                            </button>
                          </div>

                          {/* Interactive Trim Dual Sliders */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <div className="flex justify-between text-[9px] font-mono text-ink/40 mb-1">
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
                                className="w-full accent-gold h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[9px] font-mono text-ink/40 mb-1">
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
                                className="w-full accent-gold h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* Waveform Slicing Preview Visualizer */}
                          <div className="h-6 bg-cream-dark rounded border border-ink/8 relative overflow-hidden flex items-center">
                            {/* Trim region visual overlay */}
                            <div 
                              className="absolute h-full bg-ink/10 border-r border-ink/10"
                              style={{ width: `${(block.trimStart / buffer.duration) * 100}%` }}
                            />
                            <div 
                              className="absolute h-full bg-ink/10 border-l border-ink/10"
                              style={{ 
                                left: `${((block.trimEnd || buffer.duration) / buffer.duration) * 100}%`,
                                right: 0
                              }}
                            />
                            
                            {/* Simulated waveform bars */}
                            <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none">
                              {Array.from({ length: 40 }).map((_, i) => {
                                const active = (i / 40) >= (block.trimStart / buffer.duration) && (i / 40) <= ((block.trimEnd || buffer.duration) / buffer.duration);
                                return (
                                  <div
                                    key={i}
                                    style={{ height: `${20 + Math.sin(i * 0.4) * 50}%` }}
                                    className={`w-[2px] rounded-full ${active ? "bg-gold" : "bg-ink/15"}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Play & Synthesize controls */}
                    <div className="flex md:flex-col items-stretch gap-2 w-full md:w-32 self-stretch justify-center md:border-l border-ink/8 md:pl-4">
                      {isSynthesizing ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-ink/45 text-[10px] font-black uppercase tracking-[0.15em] py-2 bg-cream-light rounded-xl border border-ink/5">
                          <Loader2 className="w-4 h-4 animate-spin text-gold mb-1" />
                          <span>Rendering...</span>
                        </div>
                      ) : hasAudio ? (
                        <>
                          <button
                            onClick={() => handlePlayBlockClip(block)}
                            className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                              isTesting
                                ? "bg-ink text-cream border-ink"
                                : "bg-white text-ink/55 border-ink/10 hover:border-ink/30 hover:text-ink"
                            }`}
                          >
                            {isTesting ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                Listen
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleGenerateBlockSpeech(block)}
                            className="py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-ink/40 hover:text-gold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGenerateBlockSpeech(block)}
                          className="flex-1 bg-ink text-cream rounded-full text-[10px] font-black tracking-[0.2em] uppercase py-3 px-3 hover:bg-rose hover:text-ink transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
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
          <div className="bg-white border border-ink/5 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center justify-center">
            <Music className="w-12 h-12 text-ink/15 mb-3 animate-pulse" />
            <h3 className="text-base font-display font-black italic text-ink mb-1">No Story Active</h3>
            <p className="text-sm text-ink/45 max-w-sm">
              Create a new story manuscript or select an existing outline from the sidebar to begin crafting multi-voice narratives.
            </p>
            <button
              onClick={handleCreateStory}
              className="mt-5 bg-ink text-cream rounded-full text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2.5 hover:bg-rose hover:text-ink transition-all active:scale-[0.98] cursor-pointer"
            >
              + Create Manuscript
            </button>
          </div>
        )}

        {/* BOTTOM MASTER TIMELINE VIEW & PLAYBACK BAR */}
        {activeStory && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink/10 text-ink shadow-[0_-8px_30px_rgba(30,27,24,0.06)] p-4 sm:p-5">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink/8 pb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-gold" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45">
                  Master Multi-Voice Output Timeline
                </span>
              </div>
              
              {/* Zoom slider (hidden on the smallest screens to avoid crowding) */}
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-ink/40">Zoom:</span>
                <button 
                  onClick={() => setZoomFactor(prev => Math.max(10, prev - 5))}
                  className="w-9 h-9 rounded-full border border-ink/15 bg-white flex items-center justify-center text-ink/50 hover:text-ink hover:border-ink/40 transition-all cursor-pointer"
                  title="Zoom Out"
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
                  className="w-16 accent-gold h-1 bg-ink/10 rounded cursor-pointer"
                />
                <button 
                  onClick={() => setZoomFactor(prev => Math.min(80, prev + 5))}
                  className="w-9 h-9 rounded-full border border-ink/15 bg-white flex items-center justify-center text-ink/50 hover:text-ink hover:border-ink/40 transition-all cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TIMELINE TRACK */}
            <div className="relative bg-cream-dark border border-ink/8 rounded-xl h-24 overflow-x-auto overflow-y-hidden scrollbar-thin select-none">
              
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
                <div className="absolute left-0 top-0 bottom-0 w-5 bg-cream/60" />

                {/* Timeline time rule markings */}
                <div className="absolute left-5 right-5 top-0 h-4 border-b border-ink/8 flex items-end">
                  {Array.from({ length: Math.ceil(timelineDuration) + 2 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute bottom-0 border-l border-ink/15 text-[8px] text-ink/40 font-mono pl-1"
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
                        className={`h-full border-r border-ink/15 flex flex-col justify-between p-2 relative overflow-hidden transition-all ${
                          isPlayingSegment
                            ? "bg-rose/40 border-y border-rose-dark/40"
                            : segment.isTrimmed
                            ? "bg-ink/5 border-y border-ink/10"
                            : "bg-ink/10 border-y border-ink/15"
                        }`}
                      >
                        {/* Segment Voice Name & Index */}
                        <div className="flex items-center justify-between relative z-10">
                          <span className={`text-[9px] font-bold truncate ${isPlayingSegment ? "text-rose-dark" : "text-ink/70"}`}>
                            {idx + 1}. {segment.voiceName}
                          </span>
                          <span className="text-[8px] font-mono text-ink/40">
                            {segment.duration.toFixed(1)}s
                          </span>
                        </div>

                        {/* Segment Text preview snippet */}
                        <p className="text-[8px] text-ink/50 truncate relative z-10">
                          {segment.text || "Empty speech block"}
                        </p>

                        {/* Trim visual indicator: if trimmed, render small tag */}
                        {segment.isTrimmed && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold" title="Trimming applied" />
                        )}

                        {/* Waveform graphic inside block segment */}
                        <div className="absolute bottom-1.5 left-2 right-2 h-2 flex items-end gap-[1px] pointer-events-none opacity-40">
                          {Array.from({ length: Math.ceil(segment.duration * 3) }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`flex-1 rounded-full ${isPlayingSegment ? "bg-gold" : "bg-ink/25"}`}
                              style={{ height: `${20 + (i % 3 === 0 ? 80 : i % 2 === 0 ? 50 : 30)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {segments.length === 0 && (
                    <div className="w-full flex items-center justify-center text-xs text-ink/35">
                      Synthesize story segments to visualize track waves
                    </div>
                  )}
                </div>

                {/* SCROLLING ROSE PLAYBACK PROGRESS CURSOR */}
                {timelineDuration > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-rose-dark z-20 pointer-events-none"
                    style={{ 
                      left: `${20 + timelineCurrentTime * zoomFactor}px` 
                    }}
                  >
                    <div className="w-2.5 h-2.5 bg-rose-dark rounded-full -translate-x-[4px] shadow" />
                  </div>
                )}

              </div>
            </div>

            {/* TIMELINE CONTROLS BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-ink/10 rounded-xl px-4 py-3">
              
              {/* Play / Pause / stop and time indicators */}
              <div className="flex items-center gap-3">
                <button
                  onClick={startGlobalPlayback}
                  className="w-9 h-9 rounded-full bg-ink text-cream hover:bg-rose hover:text-ink flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title={isGlobalPlaying ? "Pause Sequencer" : "Play Sequencer"}
                >
                  {isGlobalPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={stopGlobalPlayback}
                  className="w-9 h-9 rounded-full border border-ink/15 text-ink/55 hover:border-ink/40 hover:text-ink flex items-center justify-center transition-all cursor-pointer"
                  title="Stop Playback"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Time displays */}
                <div className="flex items-center gap-1.5 font-mono text-xs text-ink/50 pl-2">
                  <span className="text-ink font-bold">
                    {Math.floor(timelineCurrentTime / 60)}:{(timelineCurrentTime % 60).toFixed(1).toString().padStart(4, "0")}
                  </span>
                  <span className="text-ink/30">/</span>
                  <span className="text-ink/50">
                    {Math.floor(timelineDuration / 60)}:{(timelineDuration % 60).toFixed(1).toString().padStart(4, "0")}
                  </span>
                </div>
              </div>

              {/* Status updates */}
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-ink/40 hidden md:block">
                {isGlobalPlaying ? "Playing Master Feed..." : "Master Sequencer Ready"}
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddBlock}
                  className="bg-white border border-ink/15 text-ink/60 rounded-full text-[10px] font-black tracking-[0.15em] uppercase px-4 py-2.5 flex items-center gap-1.5 hover:border-ink/40 hover:text-ink transition-all cursor-pointer"
                  title="Add new segment to story"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Segment
                </button>
                <button
                  onClick={handleExportMergedAudio}
                  disabled={isMerging}
                  className="bg-ink text-cream rounded-full text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2.5 hover:bg-rose hover:text-ink transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
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

            </div>

          </div>
          </div>
        )}

      </div>

    </div>
  );
}
