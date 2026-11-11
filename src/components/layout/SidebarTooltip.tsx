import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

type Side = 'right' | 'bottom' | 'top';

/** A small hover/focus tooltip for the sidebar's icon-only controls. Rendered in a portal with
 * fixed positioning so the nav list's `overflow-y-auto` can't clip it. Shows on mouse hover and on
 * keyboard focus (`:focus-visible`), never on touch. The wrapped control keeps its own aria-label;
 * this is purely visual. */
export function SidebarTooltip({
  label, hint, side = 'right', enabled = true, desktopOnly = false, className, children,
}: {
  label: string;
  /** Optional keyboard shortcut shown as a chip after the label. */
  hint?: string;
  side?: Side;
  enabled?: boolean;
  /** Only show at the `lg` breakpoint (the collapsed rail is desktop-only). */
  desktopOnly?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    if (!enabled) return;
    if (desktopOnly && !window.matchMedia('(min-width: 1024px)').matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const target = (wrapRef.current?.firstElementChild as HTMLElement | null) ?? wrapRef.current;
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (side === 'right') setPos({ x: r.right + 8, y: r.top + r.height / 2 });
      else if (side === 'bottom') setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
      else setPos({ x: r.left + r.width / 2, y: r.top - 6 });
    }, 100);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') show();
  };
  const onFocus = (e: FocusEvent) => {
    if ((e.target as HTMLElement).matches(':focus-visible')) show();
  };

  const transform =
    side === 'right' ? 'translateY(-50%)' : side === 'bottom' ? 'translateX(-50%)' : 'translate(-50%, -100%)';

  return (
    <div
      ref={wrapRef}
      className={className}
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      {pos && enabled && createPortal(
        <div
          role="tooltip"
          style={{ left: pos.x, top: pos.y, transform }}
          className={clsx(
            'sidebar-tooltip pointer-events-none fixed z-[70] flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium leading-4',
            'bg-slate-900 text-white shadow-[0_4px_12px_-2px_rgba(15,23,42,0.25)]',
            'dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-white/10 dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.5)]',
          )}
        >
          {label}
          {hint && (
            <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded px-1 font-sans text-[10.5px] font-medium bg-white/15 text-white/80">
              {hint}
            </kbd>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
