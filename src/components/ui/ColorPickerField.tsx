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

/** Swatch + hex input + quick presets — replaces a bare `<input type="color">`, which renders as
 * a tiny native square with no hex value visible and no fast way to pick a brand-consistent shade. */
export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  const swatchColor = isValidHex(value) ? value : '#3B82F6';

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="flex items-center gap-2">
        <label
          className="relative shrink-0 w-11 h-11 rounded-xl border border-gray-200 dark:border-white/10 cursor-pointer overflow-hidden shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: swatchColor }}
        >
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
          className="flex-1 rounded-xl py-2.5 px-4 text-sm font-mono uppercase bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-[22px] h-[22px] rounded-full transition-transform hover:scale-110 ${
              value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-slate-900' : ''
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>
    </div>
  );
}
