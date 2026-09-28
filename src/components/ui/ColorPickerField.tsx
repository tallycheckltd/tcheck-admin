import { Check, Pipette } from 'lucide-react';

interface ColorPickerFieldProps {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
];

const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** Returns black/white, whichever reads better on top of `hex` — used for the swatch's pipette
 * glyph, which otherwise disappears against light preset colors like #F59E0B. */
function readableOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#00000080' : '#FFFFFFB3';
}

/** Swatch + hex input + quick presets — replaces a bare `<input type="color">`, which renders as
 * a tiny native square with no hex value visible and no fast way to pick a brand-consistent shade.
 * The swatch carries a soft diagonal sheen (depth cue, not a glow) so it reads as a physical chip
 * rather than a flat color tile, and the selected preset gets a checkmark instead of a bare ring
 * so "this one is active" is legible at a glance rather than inferred from a faint outline. */
export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  const swatchColor = isValidHex(value) ? value : '#3B82F6';

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="flex items-center gap-2.5">
        <label
          className="group relative shrink-0 w-12 h-12 rounded-xl cursor-pointer overflow-hidden shadow-md ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: swatchColor }}
          title="Pick a custom color"
        >
          {/* Diagonal sheen — depth cue so the chip reads as a physical swatch, not a flat tile */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-black/10 pointer-events-none" />
          <Pipette
            size={15}
            className="absolute bottom-1 right-1 pointer-events-none"
            style={{ color: readableOn(swatchColor) }}
          />
          <input
            type="color"
            value={swatchColor}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-2 cursor-pointer opacity-0"
            aria-label="Pick a custom color"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3B82F6"
          maxLength={7}
          // A hex code is always 7 characters — flex-1 let this stretch to fill the whole row
          // width, which read as an oversized box for such a short value. A fixed width sized to
          // the content (plus breathing room) keeps it proportionate regardless of the row's
          // available space.
          className="w-28 shrink-0 rounded-xl py-2.5 px-4 text-sm font-mono uppercase bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        {PRESET_COLORS.map((c) => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`relative w-6 h-6 rounded-full shadow-sm transition-all hover:scale-110 ${
                active ? 'ring-2 ring-offset-2 ring-gray-900/70 dark:ring-white/70 dark:ring-offset-slate-900 scale-105' : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Use ${c}`}
            >
              {active && <Check size={13} strokeWidth={3} className="absolute inset-0 m-auto" style={{ color: readableOn(c) }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
