import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { Button, Input } from '../components/ui';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { login, error } = useAuth();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try { await login(identifier.trim(), password); }
    catch (reason) { setMessage(reason instanceof ApiError ? reason.message : 'Connexion impossible.'); }
    finally { setSubmitting(false); }
  }

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 px-4 py-10 subtle-grid">
    <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blood-700/10 blur-[100px]" /><div className="absolute -bottom-52 -right-40 h-[30rem] w-[30rem] rounded-full bg-blood-700/[.07] blur-[120px]" />
    <div className="relative w-full max-w-md animate-enter">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-blood-500/25 bg-gradient-to-br from-blood-700/30 to-ink-900 shadow-glow"><span className="font-display text-2xl font-black text-white">M</span></div><h1 className="font-display text-xl font-black tracking-[.26em] text-white">MADRAZO</h1><p className="mt-2 text-[10px] font-bold uppercase tracking-[.22em] text-zinc-600">Centre de commandement financier</p></div>
      <section className="panel p-6 sm:p-8"><div className="mb-6"><div className="mb-2 flex items-center gap-2 text-blood-400"><LockKeyhole className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[.18em]">Accès sécurisé</span></div><h2 className="text-xl font-bold text-white">Identification</h2><p className="mt-1 text-sm text-zinc-500">Connectez-vous avec votre compte Madrazo.</p></div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Pseudo" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Votre pseudo" />
          <label className="block"><span className="label">Mot de passe</span><span className="relative block"><input className="field pr-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-600 hover:text-zinc-300" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
          {(message || error) && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-3.5 py-3 text-sm text-red-300">{message || error}</div>}
          <Button className="mt-2 w-full" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{submitting ? 'Vérification…' : 'Ouvrir la session'}</Button>
        </form>
        <p className="mt-6 border-t border-white/[.06] pt-5 text-center text-[11px] leading-relaxed text-zinc-700">Accès journalisé · Session chiffrée · Tentatives limitées</p>
      </section>
    </div>
  </main>;
}
