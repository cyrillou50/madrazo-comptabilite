import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LoaderCircle, Plus, RotateCcw, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { statusTone } from '../lib/format';

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return <button className={clsx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
    variant === 'primary' && 'bg-blood-600 text-on-accent shadow-lg shadow-blood-900/30 hover:bg-blood-500',
    variant === 'secondary' && 'border border-white/10 bg-white/[.05] text-zinc-200 hover:bg-white/[.09]',
    variant === 'ghost' && 'text-zinc-400 hover:bg-white/[.06] hover:text-white',
    variant === 'danger' && 'border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    className,
  )} {...props}>{children}</button>;
}

// Les champs transmettent leur ref : react-hook-form en a besoin pour afficher les valeurs d'une fiche à modifier.
// L'aide et l'erreur restent hors du libellé et sont reliées au champ par aria-describedby.
type FieldProps = { label?: string; error?: string; hint?: ReactNode };

function useFieldIds(id: string | undefined, error: string | undefined, hint: ReactNode) {
  const generated = useId();
  const fieldId = id ?? generated;
  const messageId = error || hint ? `${fieldId}-message` : undefined;
  return { fieldId, messageId };
}

function Field({ label, error, hint, className, fieldId, messageId, children }: FieldProps & { className?: string; fieldId: string; messageId?: string; children: ReactNode }) {
  return <div className={clsx('block', className)}>
    {label && <label htmlFor={fieldId} className="label">{label}</label>}
    {children}
    {error ? <span id={messageId} className="mt-1 block text-xs text-red-400">{error}</span>
      : hint ? <span id={messageId} className="mt-1 block text-xs text-zinc-600">{hint}</span> : null}
  </div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, error, hint, className, id, ...props }, ref) {
  const { fieldId, messageId } = useFieldIds(id, error, hint);
  return <Field label={label} error={error} hint={hint} className={className} fieldId={fieldId} messageId={messageId}>
    <input ref={ref} id={fieldId} aria-invalid={error ? true : undefined} aria-describedby={messageId} className={clsx('field', error && 'border-red-500/60')} {...props} />
  </Field>;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, error, hint, children, className, id, ...props }, ref) {
  const { fieldId, messageId } = useFieldIds(id, error, hint);
  return <Field label={label} error={error} hint={hint} className={className} fieldId={fieldId} messageId={messageId}>
    <select ref={ref} id={fieldId} aria-invalid={error ? true : undefined} aria-describedby={messageId} className={clsx('field', error && 'border-red-500/60')} {...props}>{children}</select>
  </Field>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea({ label, error, hint, className, id, ...props }, ref) {
  const { fieldId, messageId } = useFieldIds(id, error, hint);
  return <Field label={label} error={error} hint={hint} className={className} fieldId={fieldId} messageId={messageId}>
    <textarea ref={ref} id={fieldId} aria-invalid={error ? true : undefined} aria-describedby={messageId} className={clsx('field min-h-24 resize-y', error && 'border-red-500/60')} {...props} />
  </Field>;
});

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

// Pile des fenêtres ouvertes : seule la plus récente réagit à Échap et garde le focus.
const openModals: string[] = [];
let bodyOverflowBeforeModals = '';

export function Modal({ open, onClose, title, description, children, size = 'md', layer = 'base' }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; layer?: 'base' | 'top' }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const modalId = useId();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!openModals.length) bodyOverflowBeforeModals = document.body.style.overflow;
    openModals.push(modalId);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const isTop = () => openModals[openModals.length - 1] === modalId;
    const listener = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      openModals.splice(openModals.indexOf(modalId), 1);
      if (!openModals.length) document.body.style.overflow = bodyOverflowBeforeModals;
      previouslyFocused?.focus();
    };
  }, [open, modalId]);
  if (!open) return null;
  // Rendue à la racine du document : un parent animé ou flouté ne peut plus la rogner ni la placer sous l'en-tête.
  return createPortal(<div className={clsx('fixed inset-0 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5', layer === 'top' ? 'z-[90]' : 'z-[80]')} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className={clsx('relative flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden border border-white/10 bg-ink-900 shadow-2xl outline-none sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl', size === 'sm' && 'max-w-md', size === 'md' && 'max-w-lg', size === 'lg' && 'max-w-2xl', size === 'xl' && 'max-w-4xl')}>
      <header className="z-30 flex shrink-0 items-start justify-between gap-4 border-b border-white/[.07] bg-ink-900/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0"><h2 id={titleId} className="text-lg font-bold text-white">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>}</div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-400"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  </div>, document.body);
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

export function FormActions({ cancel, submitting, submitLabel = 'Enregistrer', submitVariant = 'primary', cancelLabel = 'Annuler' }: { cancel: () => void; submitting?: boolean; submitLabel?: string; submitVariant?: 'primary' | 'danger'; cancelLabel?: string }) {
  return <><div aria-hidden="true" className="h-[76px]" /><div className="absolute inset-x-0 bottom-0 z-20 flex min-h-[76px] items-center justify-end gap-2 border-t border-white/[.07] bg-ink-900/95 px-5 py-4 shadow-[0_-12px_30px_rgba(0,0,0,.2)] backdrop-blur"><Button type="button" variant="ghost" onClick={cancel}>{cancelLabel}</Button><Button type="submit" variant={submitVariant} disabled={submitting}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitLabel}</Button></div></>;
}
