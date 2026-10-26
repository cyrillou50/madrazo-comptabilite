// Les droits sont regroupés par rubrique du site ; seul leur libellé est affiché, jamais leur code technique.
const sections: Array<{ prefix: string; label: string }> = [
  { prefix: 'dashboard', label: 'Tableau de bord' },
  { prefix: 'orders', label: 'Ventes' },
  { prefix: 'groups', label: 'Groupes' },
  { prefix: 'contacts', label: 'Contacts' },
  { prefix: 'catalog', label: 'Marchandises' },
  { prefix: 'stocks', label: 'Stocks' },
  { prefix: 'payments', label: 'Dettes & paiements' },
  { prefix: 'expenses', label: 'Finances' },
  { prefix: 'treasury', label: 'Finances' },
  { prefix: 'users', label: 'Utilisateurs & rôles' },
  { prefix: 'audit', label: 'Journal d’activité' },
  { prefix: 'settings', label: 'Paramètres' },
];

export interface PermissionSection<T> { label: string; items: T[] }

export function groupPermissions<T extends { code: string }>(permissions: T[]): Array<PermissionSection<T>> {
  const groups = new Map<string, T[]>();
  for (const permission of permissions) {
    const prefix = permission.code.split(':')[0] ?? '';
    const label = sections.find((section) => section.prefix === prefix)?.label ?? 'Autres droits';
    groups.set(label, [...(groups.get(label) ?? []), permission]);
  }
  const order = [...sections.map((section) => section.label), 'Autres droits'];
  return [...groups].sort(([first], [second]) => order.indexOf(first) - order.indexOf(second)).map(([label, items]) => ({ label, items }));
}
