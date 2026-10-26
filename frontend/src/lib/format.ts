export const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format;

export const number = new Intl.NumberFormat('fr-FR').format;

export function date(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(parsed);
}

export function initials(name?: string): string {
  return (name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const value = (status || '').toLowerCase();
  if (/livr|payé|actif|confirm|valid|vip|completed/.test(value)) return 'success';
  if (/attente|partiel|occasion|surveillance|pending|low/.test(value)) return 'warning';
  if (/annul|black|inactif|impay|rupture|désactiv|failed/.test(value)) return 'danger';
  if (/brouillon|archiv|lecture/.test(value)) return 'neutral';
  return 'info';
}
