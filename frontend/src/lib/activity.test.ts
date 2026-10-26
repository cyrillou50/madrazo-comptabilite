import { describe, expect, it } from 'vitest';
import { actionLabel, describeActivity, describeFields } from './activity';
import { groupPermissions } from './permissions';

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('journal d’activité lisible', () => {
  it('écrit les actions en toutes lettres, sans code technique', () => {
    const description = describeActivity({ action: 'order.created', entityType: 'order', entityId: 12, afterData: { reference: 'MDR-20261026-AB12', groupName: 'Los Reyes', totalAmount: 1250 } });
    expect(description.label).toBe('Vente créée');
    expect(normalize(description.detail)).toBe('MDR-20261026-AB12 · Los Reyes · 1 250 $');
    expect(normalize(description.sentence)).toBe('a créé la vente MDR-20261026-AB12 pour Los Reyes (1 250 $)');
    expect(description.target).toBe('Vente MDR-20261026-AB12');
    expect(description.to).toBe('/ventes');
  });

  it('décrit un changement de rôle avec l’avant et l’après', () => {
    const description = describeActivity({ action: 'user.role_updated', entityType: 'user', beforeData: { displayName: 'Bob', role: 'Vendeur' }, afterData: { displayName: 'Bob', role: 'Bras droit' } });
    expect(description.label).toBe('Rôle attribué');
    expect(description.detail).toBe('Bob · Vendeur → Bras droit');
  });

  it('reste lisible pour une action inconnue', () => {
    expect(actionLabel('group_type.created')).toBe('Type de groupe créé');
    expect(actionLabel('item_category.archived')).toBe('Catégorie de marchandises archivée');
    expect(actionLabel('truc.fait_maison')).toBe('Truc : fait maison');
  });

  it('n’affiche pas les identifiants techniques dans le détail', () => {
    const fields = describeFields({ reference: 'MDR-1', orderId: 4, amount: 500, method: 'Argent sale', permissionCodes: ['users:write'] });
    expect(fields.map((field) => field.label)).toEqual(['Référence', 'Moyen de paiement', 'Montant', 'Nombre de droits']);
    expect(JSON.stringify(fields)).not.toContain('users:write');
  });
});

describe('droits regroupés par rubrique', () => {
  it('classe les droits dans l’ordre du menu', () => {
    const sections = groupPermissions([{ code: 'users:write' }, { code: 'orders:read' }, { code: 'dashboard:read' }, { code: 'orders:write' }]);
    expect(sections.map((section) => section.label)).toEqual(['Tableau de bord', 'Ventes', 'Utilisateurs & rôles']);
    expect(sections[1]?.items).toHaveLength(2);
  });
});
