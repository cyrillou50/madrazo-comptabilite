import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, LoaderCircle, Plus, RotateCcw, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { statusTone } from '../lib/format';

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return <button className={clsx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
    variant === 'primary' && 'bg-blood-600 text-white shadow-lg shadow-blood-900/30 hover:bg-blood-500',
    variant === 'secondary' && 'border border-white/10 bg-white/[.05] text-zinc-200 hover:bg-white/[.09]',
    variant === 'ghost' && 'text-zinc-400 hover:bg-white/[.06] hover:text-white',
    variant === 'danger' && 'border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    className,
  )} {...props}>{children}</button>;
}

export function Input({ label, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return <label className={className}>
    {label && <span className="label">{label}</span>}
    <input className={clsx('field', error && 'border-red-500/60')} {...props} />
    {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
  </label>;
}

export function Select({ label, error, children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return <label className={className}>
    {label && <span className="label">{label}</span>}
    <select className={clsx('field', error && 'border-red-500/60')} {...props}>{children}</select>
    {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
  </label>;
}

export function Textarea({ label, error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return <label className={className}>
    {label && <span className="label">{label}</span>}
    <textarea className={clsx('field min-h-24 resize-y', error && 'border-red-500/60')} {...props} />
    {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
  </label>;
}

export function Badge({ children, tone, className }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; className?: string }) {
  const actualTone = tone ?? statusTone(String(children));
  return <span className={clsx(
    'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
    actualTone === 'success' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    actualTone === 'warning' && 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    actualTone === 'danger' && 'border-red-500/20 bg-red-500/10 text-red-300',
    actualTone === 'neutral' && 'border-white/10 bg-white/[.04] text-zinc-400',
    actualTone === 'info' && 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    className,
  )}>{children}</span>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('panel', className)}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.24em] text-blood-400">{eyebrow}</p>}
      <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">{description}</p>
    </div>
    {action}
  </header>;
}

export function SearchField({ value, onChange, placeholder = 'Rechercher…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="relative block min-w-0 flex-1 sm:max-w-xs">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field pl-9" />
  </label>;
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', listener);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', listener); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-900 shadow-2xl sm:rounded-2xl', size === 'md' && 'max-w-lg', size === 'lg' && 'max-w-2xl', size === 'xl' && 'max-w-4xl')}>
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[.07] bg-ink-900/95 px-5 py-4 backdrop-blur">
        <div><h2 id="modal-title" className="text-lg font-bold text-white">{title}</h2>{description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}</div>
        <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/[.06] hover:text-white"><X className="h-5 w-5" /></button>
      </header>
      {children}
    </div>
  </div>;
}

export function LoadingState({ label = 'Chargement des données…' }: { label?: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-zinc-500"><LoaderCircle className="h-7 w-7 animate-spin text-blood-500" /><p className="text-sm">{label}</p></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center"><span className="rounded-full bg-red-500/10 p-3"><AlertTriangle className="h-6 w-6 text-red-400" /></span><div><p className="font-semibold text-zinc-200">Chargement impossible</p><p className="mt-1 max-w-md text-sm text-zinc-500">{message}</p></div>{retry && <Button variant="secondary" size="sm" onClick={retry}><RotateCcw className="h-4 w-4" />Réessayer</Button>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: () => void }) {
  return <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><div className="mb-3 rounded-full border border-white/[.06] bg-white/[.03] p-3 text-zinc-500"><Search className="h-6 w-6" /></div><p className="font-semibold text-zinc-200">{title}</p><p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>{action && <Button className="mt-4" size="sm" onClick={action}><Plus className="h-4 w-4" />Ajouter</Button>}</div>;
}

export function FormActions({ cancel, submitting, submitLabel = 'Enregistrer' }: { cancel: () => void; submitting?: boolean; submitLabel?: string }) {
  return <div className="mt-6 flex justify-end gap-2 border-t border-white/[.07] pt-5"><Button type="button" variant="ghost" onClick={cancel}>Annuler</Button><Button type="submit" disabled={submitting}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitLabel}</Button></div>;
}
