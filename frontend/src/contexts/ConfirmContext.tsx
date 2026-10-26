import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FormActions, Modal, Textarea } from '../components/ui';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
interface PromptOptions extends ConfirmOptions {
  label: string;
  placeholder?: string;
  minLength?: number;
}
interface DialogState extends PromptOptions { withInput: boolean }
interface ConfirmValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmValue | null>(null);

/** Remplace les fenêtres natives du navigateur par des boîtes de dialogue cohérentes avec le site. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const resolver = useRef<((result: string | boolean | null) => void) | null>(null);

  const open = useCallback((state: DialogState) => new Promise<string | boolean | null>((resolve) => {
    resolver.current?.(state.withInput ? null : false);
    resolver.current = resolve;
    setValue('');
    setError(undefined);
    setDialog(state);
  }), []);

  const close = useCallback((result: string | boolean | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback(async (options: ConfirmOptions) => Boolean(await open({ ...options, label: '', withInput: false })), [open]);
  const prompt = useCallback(async (options: PromptOptions) => {
    const result = await open({ ...options, withInput: true });
    return typeof result === 'string' ? result : null;
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!dialog) return;
    if (!dialog.withInput) { close(true); return; }
    const trimmed = value.trim();
    const minLength = dialog.minLength ?? 1;
    if (trimmed.length < minLength) { setError(minLength > 1 ? `${minLength} caractères minimum.` : 'Ce champ est obligatoire.'); return; }
    close(trimmed);
  }

  const contextValue = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const tone = dialog?.tone ?? 'danger';

  return <ConfirmContext.Provider value={contextValue}>
    {children}
    <Modal open={!!dialog} onClose={() => close(dialog?.withInput ? null : false)} title={dialog?.title || ''} size="sm" layer="top">
      <form onSubmit={submit} className="p-5">
        <div className="flex gap-3">
          {tone === 'danger' && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><AlertTriangle className="h-5 w-5" /></span>}
          {dialog?.message && <div className="pt-1 text-sm leading-relaxed text-zinc-400">{dialog.message}</div>}
        </div>
        {dialog?.withInput && <Textarea label={dialog.label} placeholder={dialog.placeholder} value={value} onChange={(event) => { setValue(event.target.value); setError(undefined); }} error={error} className="mt-4" autoFocus maxLength={500} />}
        <FormActions cancel={() => close(dialog?.withInput ? null : false)} submitLabel={dialog?.confirmLabel || 'Confirmer'} submitVariant={tone === 'danger' ? 'danger' : 'primary'} />
      </form>
    </Modal>
  </ConfirmContext.Provider>;
}

// Ce hook partage volontairement le fichier du provider de contexte.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmValue {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm doit être utilisé dans ConfirmProvider');
  return value;
}
