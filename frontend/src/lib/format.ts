// La devise suit le paramètre « Devise » et n'affiche que son symbole ($, €), jamais « $US ».
function currencyFormatter(code: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
}

let currencyCode = 'USD';
let formatter = currencyFormatter(currencyCode);

export function setCurrencyCode(code: string | null | undefined): void {
  const next = code === 'EUR' ? 'EUR' : 'USD';
  if (next === currencyCode) return;
  currencyCode = next;
  formatter = currencyFormatter(next);
}

export function currency(value: number): string {
  return formatter.format(value);
}

export function currencySymbol(): string {
  return formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? '$';
}

export const number = new Intl.NumberFormat('fr-FR').format;

export function date(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(parsed);
}

const relativeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

export function relativeTime(value?: string | null, now = Date.now()): string {
  if (!value) return '—';
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return '—';
  const seconds = Math.round((parsed - now) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return 'à l’instant';
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  if (Math.abs(days) < 7) return relativeFormatter.format(days, 'day');
  return date(value);
}

export function initials(name?: string): string {
  return (name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const value = (status || '').toLowerCase();
  // Les cas négatifs passent en premier : « Non payé » contient aussi « payé ».
  if (/annul|black|inactif|non payé|impay|rupture|désactiv|failed/.test(value)) return 'danger';
  if (/attente|partiel|occasion|surveillance|pending|low|faible/.test(value)) return 'warning';
  if (/livr|payé|actif|confirm|valid|vip|completed/.test(value)) return 'success';
  if (/brouillon|archiv|lecture/.test(value)) return 'neutral';
  return 'info';
}
