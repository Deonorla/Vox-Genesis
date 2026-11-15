import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Compact pill (block cards) or full-width field (forms). */
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

const MENU_MAX_H = 264;

/**
 * Custom select styled for the design system: white pill trigger with a
 * rotating chevron, and a floating menu portaled to <body> (fixed position)
 * so card `overflow-hidden` can never clip it.
 */
export default function Dropdown({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? options[0]?.label ?? "Select…";

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 200);
    let left = r.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;

    const menuH = Math.min(options.length * 36 + 14, MENU_MAX_H);
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < menuH + 12 && r.top > spaceBelow;
    const top = flip ? r.top - menuH - 8 : r.bottom + 8;

    setPos({ top: Math.max(12, top), left, width });
  };

  // Position while open (recomputed on scroll/resize so it follows the trigger)
  useLayoutEffect(() => {
    if (open) place();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const reposition = () => place();

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const triggerCls =
    size === "sm"
      ? "inline-flex items-center gap-2 max-w-[230px] bg-white border border-ink/10 rounded-full pl-3 pr-2.5 py-2 text-xs text-ink hover:border-ink/30 focus:outline-none focus:border-ink/35 transition-all cursor-pointer"
      : "w-full flex items-center justify-between gap-2 bg-white border border-ink/10 rounded-full px-4 py-2.5 text-sm text-ink hover:border-ink/30 focus:outline-none focus:border-ink/35 transition-all cursor-pointer";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerCls} ${className}`}
      >
        <span className="truncate text-left">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-ink/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: MENU_MAX_H }}
            className="fixed z-[80] bg-white border border-ink/10 rounded-2xl shadow-2xl shadow-ink/15 p-1.5 overflow-y-auto scrollbar-thin"
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    active
                      ? "bg-cream-dark text-ink font-bold"
                      : "text-ink/60 hover:bg-cream-light hover:text-ink"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-gold shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
