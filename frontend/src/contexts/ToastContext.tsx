import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

type Tone = 'success' | 'error';
interface Toast { id: number; message: string; tone: Tone }
interface ToastValue { notify: (message: string, tone?: Tone) => void }

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => <div key={toast.id} className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur ${toast.tone === 'success' ? 'border-emerald-500/25 bg-emerald-950/90' : 'border-red-500/25 bg-red-950/90'}`}>
        {toast.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" /> : <CircleAlert className="mt-0.5 h-5 w-5 text-red-400" />}
        <p className="flex-1 text-sm text-zinc-100">{toast.message}</p>
        <button onClick={() => dismiss(toast.id)} aria-label="Fermer la notification" className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
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
