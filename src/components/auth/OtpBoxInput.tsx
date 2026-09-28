import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

interface OtpBoxInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  /** Fires once `value` reaches `length` digits — callers usually auto-submit from this. */
  onComplete?: (value: string) => void;
  /** Bumping this (e.g. on every failed attempt) re-triggers the shake + clears focus back to box 0. */
  shakeKey?: number;
  disabled?: boolean;
}

/** Six individually-boxed digits instead of one plain text field — one `<input>` per box, each
 * holding at most one character, auto-advancing on type/backspace/arrow keys and accepting a full
 * pasted code in one go. Used by both the dashboard login OTP step and (conceptually) mirrors the
 * iOS/Android OtpVerificationScreen box UI for a consistent cross-platform feel. */
export function OtpBoxInput({ length = 6, value, onChange, onComplete, shakeKey, disabled }: OtpBoxInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (shakeKey === undefined) return;
    setShake(true);
    inputRefs.current[0]?.focus();
    const t = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(t);
  }, [shakeKey]);

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setDigitAt = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) {
      setDigitAt(index, '');
      return;
    }
    if (incoming.length > 1) {
      // A full code was typed/autofilled into one box (common on password-manager autofill).
      onChange(incoming.slice(0, length));
      const nextEmpty = Math.min(incoming.length, length - 1);
      inputRefs.current[nextEmpty]?.focus();
      return;
    }
    setDigitAt(index, incoming);
    if (index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigitAt(index - 1, '');
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className={`flex justify-center gap-2.5 ${shake ? 'animate-shake' : ''}`}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          autoFocus={index === 0}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`w-11 h-14 text-center text-xl font-bold rounded-xl bg-white/5 border text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all
            ${digit ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10'}`}
        />
      ))}
    </div>
  );
}
