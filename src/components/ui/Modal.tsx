import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg mx-4 glass-light dark:glass rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Header stays put; only the body below scrolls — tall content (e.g. the school
                settings form) used to just overflow past the viewport with no way to reach the
                submit button. */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-500 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto min-h-0">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
