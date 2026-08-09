import type { ReactNode } from 'react';

interface Mark {
  value: number;
  label: string;
}

interface SliderProps {
  // Widened from `string` to `ReactNode` so callers can inject a plain-language qualitative badge
  // (e.g. "Strong"/"Weak") right next to the label — a plain string remains perfectly valid here,
  // this is purely additive.
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  marks?: Mark[];
  helpText?: string;
  disabled?: boolean;
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '', marks, helpText, disabled }: SliderProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{label}</label>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
            {value}{unit}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-white/10 accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {marks && marks.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          {marks.map((m) => (
            <span key={m.value}>{m.label}</span>
          ))}
        </div>
      )}
      {helpText && <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>}
    </div>
  );
}
