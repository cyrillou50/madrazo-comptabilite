import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

type Tone = 'success' | 'error';
interface Toast { id: number; message: string; tone: Tone }
interface ToastValue { notify: (message: string, tone?: Tone) => void }

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);
  const notify = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++nextId.current;
    setToasts((items) => [...items.slice(-3), { id, message, tone }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), 4500));
  }, [dismiss]);
  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]">
      {toasts.map((toast) => <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live={toast.tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true" className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur animate-enter ${toast.tone === 'success' ? 'border-emerald-500/25 bg-emerald-950/95' : 'border-red-500/25 bg-red-950/95'}`}>
        {toast.tone === 'success' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />}
        <p className="flex-1 text-sm leading-relaxed text-zinc-100">{toast.message}</p>
        <button type="button" onClick={() => dismiss(toast.id)} aria-label="Fermer la notification" className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"><X className="h-4 w-4" /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

// Ce hook partage volontairement le fichier du provider de contexte.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast doit être utilisé dans ToastProvider');
  return value;
}
