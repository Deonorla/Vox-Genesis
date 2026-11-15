import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  ArrowRight,
  Play,
  Sparkles,
  FileText,
  Mic,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

/** Session shape persisted to localStorage on login (no backend). */
export interface Session {
  name: string;
  email: string;
  at: number;
}

interface LandingPageProps {
  onLogin: (session: Session) => void;
}

const NAV_LINKS = [
  { id: "studios", label: "Studios" },
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
];

const TICKER_ITEMS = [
  "EDGE NEURAL TTS",
  "MULTI-VOICE STORIES",
  "VOICE CLONING",
  "400+ NEURAL VOICES",
  "TRIM & MERGE",
  "WAV MASTER EXPORT",
  "SCRIPT NARRATION",
  "70+ LANGUAGES",
];

const STATS = [
  { value: "400+", label: "Neural Voices" },
  { value: "70+", label: "Languages" },
  { value: "3", label: "Creative Studios" },
  { value: "24kHz", label: "Studio Output" },
];

const STUDIOS = [
  {
    icon: Sparkles,
    tag: "Studio 01",
    title: "Story Architect",
    desc: "Block-based storytelling on a visual timeline. Cast a different voice per segment, trim each take, then merge everything into one master track.",
    points: ["Multi-voice timeline", "Per-block trimming", "Single WAV master"],
  },
  {
    icon: FileText,
    tag: "Studio 02",
    title: "Script Studio",
    desc: "Paste a script, choose from 400+ neural voices, set the delivery rate, and generate broadcast-ready audio in seconds — with a full local vault.",
    points: ["Instant synthesis", "Playback rate control", "Local audio vault"],
  },
  {
    icon: Mic,
    tag: "Studio 03",
    title: "Voice Clone Studio",
    desc: "Record or upload a sample and register a reusable voice signature that rides along with every generation you make.",
    points: ["Record or upload", "Trait tagging", "Reusable profiles"],
  },
];

const STEPS = [
  {
    num: "01",
    title: "Write",
    desc: "Draft your script or storyboard in the studio, block by block.",
  },
  {
    num: "02",
    title: "Cast",
    desc: "Pick a neural voice — or one you cloned — and set the delivery rate.",
  },
  {
    num: "03",
    title: "Export",
    desc: "Synthesize, trim on the timeline, and download MP3 or WAV masters.",
  },
];

/** Decorative hero waveform — bars breathe on a loop. */
function HeroWaveform() {
  const bars = Array.from({ length: 34 });
  return (
    <div className="flex items-end justify-center gap-[3px] h-16 px-4">
      {bars.map((_, i) => {
        const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const h = 18 + seed * 44;
        return (
          <div
            key={i}
            style={{
              height: `${h}px`,
              animationDuration: `${0.9 + seed * 1.1}s`,
              animationDelay: `${seed * 0.6}s`,
            }}
            className={`w-[3px] rounded-full origin-bottom animate-wave-bar ${
              i % 5 === 0 ? "bg-gold" : "bg-ink/20"
            }`}
          />
        );
      })}
    </div>
  );
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Login form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<number | null>(null);

  // Header hairline on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Modal: escape to close + lock background scroll
  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [loginOpen]);

  useEffect(() => () => {
    if (busyTimer.current) window.clearTimeout(busyTimer.current);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openLogin = () => {
    setFormError(null);
    setLoginOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }
    setFormError(null);
    setBusy(true);
    // Purely local session — no network, no database.
    busyTimer.current = window.setTimeout(() => {
      onLogin({ name: name.trim(), email: email.trim(), at: Date.now() });
    }, 450);
  };

  return (
    <div className="min-h-screen bg-cream text-ink font-sans antialiased">

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-cream/95 backdrop-blur-xl border-b border-ink/8 shadow-sm"
            : "bg-cream/70 backdrop-blur-md border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-full bg-ink text-cream flex items-center justify-center shadow-lg shadow-ink/15">
              <Volume2 className="w-4 h-4" />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="font-display font-black text-[13px] tracking-[0.18em] uppercase">
                Vox·Genesis
              </span>
              <span className="text-[8px] font-black tracking-[0.35em] uppercase text-ink/40 mt-1">
                Speech Suite
              </span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 hover:text-ink transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={openLogin}
              className="hidden sm:inline-flex items-center gap-2 bg-white border border-ink/12 text-ink/65 rounded-full px-4 py-2.5 text-[10px] font-black tracking-[0.18em] uppercase hover:border-ink/40 hover:text-ink transition-all cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={openLogin}
              className="inline-flex items-center gap-2 bg-ink text-cream rounded-full px-4 sm:px-5 py-2.5 text-[10px] font-black tracking-[0.18em] uppercase hover:bg-rose hover:text-ink transition-all active:scale-[0.98] cursor-pointer"
            >
              Open Studio
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 px-5 sm:px-8 overflow-hidden">
        {/* Soft light blooms */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-32 w-[440px] h-[440px] rounded-full bg-rose/30 blur-[110px]" />
          <div className="absolute top-56 -left-40 w-[400px] h-[400px] rounded-full bg-gold/10 blur-[110px]" />
        </div>

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 bg-white border border-ink/10 rounded-full px-3.5 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-black tracking-[0.3em] uppercase text-ink/50">
                Editorial speech suite
              </span>
            </span>

            <h1 className="font-display font-black text-ink leading-[0.92] tracking-tight text-[clamp(2.75rem,8vw,5.25rem)]">
              Text in.
              <br />
              Voice <em className="italic text-gold">out.</em>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-ink/55 leading-relaxed max-w-xl">
              An editorial-grade speech studio for scripts, stories, and custom voices —
              powered by 400+ Microsoft Edge neural voices across 70+ languages.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={openLogin}
                className="inline-flex items-center gap-2.5 bg-ink text-cream rounded-full px-7 py-4 text-[11px] font-black tracking-[0.22em] uppercase shadow-lg shadow-ink/15 hover:bg-rose hover:text-ink active:scale-[0.98] transition-all cursor-pointer"
              >
                Enter the Studio
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollTo("how")}
                className="inline-flex items-center gap-2.5 bg-white border border-ink/12 text-ink/65 rounded-full px-7 py-4 text-[11px] font-black tracking-[0.18em] uppercase hover:border-ink/40 hover:text-ink transition-all cursor-pointer"
              >
                How it works
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-ink/40">
              <span>NO ACCOUNT NEEDED</span>
              <span className="w-1 h-1 rounded-full bg-rose-dark/50" />
              <span>SESSION STORED LOCALLY</span>
              <span className="w-1 h-1 rounded-full bg-rose-dark/50" />
              <span>MP3 · WAV EXPORT</span>
            </div>
          </motion.div>

          {/* Studio mock card */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="bg-white border border-ink/8 rounded-3xl shadow-[0_24px_60px_-24px_rgba(30,27,24,0.25)] p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-44 h-44 bg-rose/25 blur-3xl rounded-full pointer-events-none" />

              <div className="relative flex items-center justify-between mb-5 pb-4 border-b border-ink/8">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current" />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.28em] text-ink/45">
                    Master Output
                  </span>
                </div>
                <span className="font-mono text-[9px] text-ink/35">24 kHz · MONO</span>
              </div>

              <div className="relative mb-5">
                <p className="font-display font-black italic text-lg sm:text-xl text-ink leading-tight">
                  Chapter 01 — The Descent
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/40">
                  en-US-BrianNeural · 00:42
                </p>
              </div>

              <div className="relative bg-cream-light border border-ink/8 rounded-2xl py-4 mb-5">
                <HeroWaveform />
              </div>

              <div className="relative flex items-center justify-between gap-3">
                <span className="w-11 h-11 rounded-full bg-ink text-cream flex items-center justify-center shadow-md shadow-ink/20">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
                  <div className="h-full w-2/5 rounded-full bg-gold" />
                </div>
                <span className="font-mono text-[10px] text-ink/40">0:17 / 0:42</span>
              </div>
            </div>

            {/* Floating engine pill */}
            <div className="absolute -bottom-5 left-4 sm:left-8 bg-white border border-ink/10 rounded-full shadow-lg shadow-ink/10 px-4 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-ink/55">
                Edge Neural TTS · Online
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Ticker ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden bg-white border-y border-ink/8 py-3.5">
        <motion.div
          className="flex gap-10 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-4 text-[9px] font-black tracking-[0.35em] uppercase text-ink/40"
            >
              <span className="w-1 h-1 rounded-full bg-rose-dark/60 inline-block shrink-0" />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="bg-cream-light py-14 sm:py-16 px-5 sm:px-8 border-b border-ink/8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="text-center"
            >
              <p className="font-display text-3xl sm:text-4xl font-black text-ink mb-1.5">
                {stat.value}
              </p>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-ink/40">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Studios ───────────────────────────────────────────────────── */}
      <section id="studios" className="py-20 sm:py-28 px-5 sm:px-8 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl mb-12 sm:mb-16"
          >
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-gold mb-4">
              The Suite
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-ink leading-[1.05] tracking-tight">
              Three studios.
              <br />
              One <em className="italic text-gold">voice engine.</em>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {STUDIOS.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white border border-ink/8 rounded-3xl p-6 sm:p-7 hover:shadow-[0_20px_50px_-30px_rgba(30,27,24,0.35)] hover:-translate-y-1 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="w-11 h-11 rounded-full bg-cream-dark flex items-center justify-center border border-ink/8">
                    <card.icon size={19} className="text-ink/65" />
                  </span>
                  <span className="font-mono text-[9px] tracking-wider uppercase text-ink/35">
                    {card.tag}
                  </span>
                </div>

                <h3 className="font-display text-xl font-black text-ink mb-3">
                  {card.title}
                </h3>
                <p className="text-sm text-ink/55 leading-relaxed mb-5 flex-1">
                  {card.desc}
                </p>

                <ul className="flex flex-wrap gap-2 mb-6">
                  {card.points.map((p) => (
                    <li
                      key={p}
                      className="text-[9px] font-black uppercase tracking-[0.14em] text-ink/50 bg-cream-dark border border-ink/8 rounded-full px-2.5 py-1"
                    >
                      {p}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={openLogin}
                  className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-gold hover:text-rose-dark transition-colors cursor-pointer self-start"
                >
                  Open Studio <ArrowRight size={11} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section id="how" className="bg-cream-light py-20 sm:py-28 px-5 sm:px-8 border-y border-ink/8 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="text-center mb-14 sm:mb-20"
          >
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-gold mb-4">
              The Workflow
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-ink leading-tight tracking-tight">
              From manuscript to
              <br />
              master track.
            </h2>
          </motion.div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-ink/10" />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.12 }}
                className="relative flex flex-col items-center text-center"
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-display text-7xl sm:text-8xl font-black text-ink/[0.05] select-none leading-none pointer-events-none">
                  {step.num}
                </span>
                <div className="relative z-10 w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 border border-ink/10 shadow-sm">
                  <span className="font-display font-black text-xl text-ink">
                    {step.num}
                  </span>
                </div>
                <p className="text-[9px] font-black tracking-[0.3em] uppercase text-gold mb-2">
                  Step {step.num}
                </p>
                <h3 className="font-display text-xl font-black text-ink mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-ink/55 leading-relaxed max-w-60">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex justify-center mt-14 sm:mt-16"
          >
            <button
              onClick={openLogin}
              className="inline-flex items-center gap-2.5 bg-ink text-cream rounded-full px-8 py-4 text-[11px] font-black tracking-[0.2em] uppercase shadow-lg shadow-ink/15 hover:bg-rose hover:text-ink active:scale-[0.98] transition-all cursor-pointer"
            >
              Start Speaking <ArrowRight size={14} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="max-w-5xl mx-auto bg-white border border-ink/8 rounded-[2rem] px-6 sm:px-12 py-14 sm:py-16 text-center relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 bg-rose/25 blur-[90px] rounded-full" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 bg-gold/10 blur-[90px] rounded-full" />

          <div className="relative">
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-gold mb-4">
              Ready when you are
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-ink leading-[1.05] tracking-tight max-w-2xl mx-auto">
              Give your words a <em className="italic text-gold">voice.</em>
            </h2>
            <p className="mt-5 text-sm sm:text-base text-ink/55 max-w-lg mx-auto leading-relaxed">
              Sign in and start synthesizing — your scripts, voices, and history stay
              saved right here in your browser.
            </p>
            <button
              onClick={openLogin}
              className="mt-8 inline-flex items-center gap-2.5 bg-ink text-cream rounded-full px-8 py-4 text-[11px] font-black tracking-[0.22em] uppercase shadow-lg shadow-ink/15 hover:bg-rose hover:text-ink active:scale-[0.98] transition-all cursor-pointer"
            >
              Open the Studio <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-cream-dark border-t border-ink/8 pt-14 pb-8 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-ink/8">
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

            <div>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase text-ink/40 mb-4">
                Explore
              </p>
              <ul className="space-y-2.5">
                {NAV_LINKS.map((link) => (
                  <li key={link.id}>
                    <button
                      onClick={() => scrollTo(link.id)}
                      className="text-xs text-ink/55 hover:text-ink transition-colors cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

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

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-ink/35 text-center sm:text-left">
              © {new Date().getFullYear()} VoxGenesis Speech Generator
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

      {/* ── Login modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {loginOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setLoginOpen(false)}
          >
            <div className="absolute inset-0 bg-ink/35 backdrop-blur-sm" />

            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full sm:max-w-md bg-white border border-ink/8 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-ink/20 p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
            >
              <button
                onClick={() => setLoginOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border border-ink/10 bg-white flex items-center justify-center text-ink/45 hover:text-ink hover:border-ink/30 transition-all cursor-pointer"
                aria-label="Close sign in"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center mb-5 shadow-md shadow-ink/15">
                <Volume2 className="w-4.5 h-4.5" />
              </div>

              <p className="text-[9px] font-black tracking-[0.4em] uppercase text-gold mb-3">
                Welcome back
              </p>
              <h3 className="font-display text-2xl sm:text-[1.75rem] font-black text-ink leading-tight tracking-tight">
                Enter the <em className="italic text-gold">studio.</em>
              </h3>
              <p className="mt-3 text-sm text-ink/55 leading-relaxed">
                No account or database — your session is stored locally in this browser
                and can be cleared anytime.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="login-name"
                    className="block text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 mb-2"
                  >
                    Display name
                  </label>
                  <input
                    id="login-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="w-full bg-cream/70 border border-ink/10 rounded-full px-5 py-3 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/35 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-cream/70 border border-ink/10 rounded-full px-5 py-3 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/35 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-[10px] font-black uppercase tracking-[0.25em] text-ink/45 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-cream/70 border border-ink/10 rounded-full px-5 py-3 pr-12 text-sm text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/35 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-ink/40 hover:text-ink transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-xs font-semibold text-rose-dark bg-rose/20 border border-rose/40 rounded-xl px-3.5 py-2.5">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-ink text-cream rounded-full py-3.5 text-[11px] font-black tracking-[0.22em] uppercase shadow-lg shadow-ink/15 hover:bg-rose hover:text-ink active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      Enter the Studio
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-wider text-ink/35">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Session → localStorage only
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
