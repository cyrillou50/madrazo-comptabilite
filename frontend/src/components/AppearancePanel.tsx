import { useEffect, useMemo, useState } from 'react';
import { Check, Palette, RotateCcw, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import { appearancePresets, defaultAppearance, fundColorsTooClose, resolvePalette, type Appearance } from '../lib/appearance';
import { Badge, Button, Panel } from './ui';

const fields: Array<{ key: keyof Appearance; label: string; hint: string }> = [
  { key: 'accent', label: 'Couleur principale', hint: 'Boutons, liens, menu actif et graphiques des ventes.' },
  { key: 'background', label: 'Fond', hint: 'La teinte est gardée, le fond reste sombre pour que les textes restent lisibles.' },
  { key: 'clean', label: 'Argent propre', hint: 'Graphiques et pastilles de trésorerie.' },
  { key: 'dirty', label: 'Argent sale', hint: 'Graphiques et pastilles de trésorerie.' },
];

const sameAppearance = (first: Appearance, second: Appearance) => fields.every(({ key }) => first[key] === second[key]);

function ColorField({ label, hint, value, adjusted, disabled, onChange }: { label: string; hint: string; value: string; adjusted: boolean; disabled: boolean; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return <div>
    <span className="label">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value.toLowerCase())} className="h-[42px] w-12 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-ink-950/70 p-1 disabled:cursor-not-allowed" />
      <input aria-label={`${label} (code couleur)`} value={text} disabled={disabled} maxLength={7} spellCheck={false} className="field font-mono uppercase" onChange={(event) => {
        setText(event.target.value);
        if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
      }} />
    </div>
    <span className="mt-1 block text-xs text-zinc-600">{adjusted ? 'Éclaircie automatiquement pour rester lisible sur le fond.' : hint}</span>
  </div>;
}

/** Choix des couleurs du site : thèmes prêts à l'emploi ou couleurs libres, avec lisibilité garantie. */
export function AppearancePanel({ value, disabled, onChange }: { value: Appearance; disabled: boolean; onChange: (value: Appearance) => void }) {
  const palette = useMemo(() => resolvePalette(value), [value]);
  const adjusted = { accent: palette.accent[600] !== value.accent, background: false, clean: palette.fund.clean !== value.clean, dirty: palette.fund.dirty !== value.dirty };

  return <Panel className="p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-blood-500/10 p-2.5 text-blood-400"><Palette className="h-5 w-5" /></span><div><h2 className="font-semibold text-zinc-100">Apparence</h2><p className="text-xs text-zinc-600">Couleurs du site pour tous les membres · aperçu immédiat, appliqué à l’enregistrement</p></div></div>
      {!disabled && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(defaultAppearance)} disabled={sameAppearance(value, defaultAppearance)}><RotateCcw className="h-4 w-4" />Couleurs d’origine</Button>}</div>

    <p className="label">Thèmes</p>
    <div className="grid gap-2 sm:grid-cols-3">{appearancePresets.map((preset) => {
      const selected = sameAppearance(preset.appearance, value);
      return <button key={preset.id} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onChange(preset.appearance)} className={clsx('flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed', selected ? 'border-blood-500/50 bg-blood-500/10' : 'border-white/[.07] bg-white/[.02] hover:bg-white/[.05]')}>
        <span className="flex shrink-0 overflow-hidden rounded-lg border border-white/10" aria-hidden="true">{fields.map(({ key }) => <span key={key} className="h-7 w-3.5" style={{ background: preset.appearance[key] }} />)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{preset.label}</span>
        {selected && <Check className="h-4 w-4 shrink-0 text-blood-400" />}
      </button>;
    })}</div>

    <p className="label mt-5">Couleurs personnalisées</p>
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <ColorField key={field.key} label={field.label} hint={field.hint} value={value[field.key]} adjusted={adjusted[field.key]} disabled={disabled} onChange={(color) => onChange({ ...value, [field.key]: color })} />)}</fieldset>

    {fundColorsTooClose(palette) && <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-3 text-xs text-amber-200"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />L’argent propre et l’argent sale ont des couleurs trop proches : ils seront difficiles à distinguer dans les graphiques.</p>}

    <div className="mt-5 rounded-xl border border-white/[.07] bg-ink-950/60 p-4" aria-label="Aperçu">
      <p className="label">Aperçu</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" tabIndex={-1}>Bouton principal</Button>
        <span className="text-sm font-semibold text-blood-400">Lien</span>
        <Badge tone="info">Statut</Badge>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.fund.clean }} />Argent propre</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.fund.dirty }} />Argent sale</span>
      </div>
      <p className="mt-3 text-xs text-zinc-600">Les textes restent toujours lisibles : une couleur trop sombre est éclaircie, et le texte des boutons passe en blanc ou en noir selon la couleur choisie.</p>
    </div>
  </Panel>;
}
