import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../types';
import { DashboardPage } from './DashboardPage';

const state = vi.hoisted(() => ({ data: null as DashboardData | null }));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ data: state.data, loading: false, error: null, reload: () => undefined }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

const sample: DashboardData = {
  totals: { received: 142_000, revenue: 184_500, grossProfit: 61_200, expenses: 23_800, cashBalance: 96_400, outstandingDebt: 42_500, salesCount: 37, groupsCount: 6, contactsCount: 24, pendingOrders: 4, lowStockItems: 2 },
  receivedDirty: 118_000,
  paymentsByMethod: [{ name: 'Argent sale', fund: 'dirty', amount: 118_000 }, { name: 'Espèces', fund: 'clean', amount: 24_000 }],
  treasury: {
    cleanBalance: 51_200, dirtyBalance: 45_200, launderedDirty: 90_000, launderedClean: 63_000, launderingFees: 27_000, launderingCount: 3,
    depositsClean: 15_000, depositsDirty: 10_000,
    timeline: [{ date: '2026-10-01', clean: 30_000, dirty: 60_000 }, { date: '2026-10-27', clean: 51_200, dirty: 45_200 }],
  },
  salesTrend: [{ date: '2026-10-26', sales: 9_000, received: 4_500, profit: 3_000 }],
  salesByItem: [], activeGroups: [{ name: 'Los Reyes', amount: 58_000, orders: 11 }],
  topItems: [{ name: 'Pistolet', quantity: 42, amount: 189_000 }], recentOrders: [], lowStock: [],
};

const normalize = (value: string | null) => (value ?? '').replace(/\s/g, ' ');

function renderDashboard(data: DashboardData) {
  state.data = data;
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>);
}

beforeAll(() => {
  // Recharts mesure son conteneur : jsdom n'a pas de ResizeObserver.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

describe('tableau de bord', () => {
  it('affiche la trésorerie : argent propre, argent sale, blanchiment et apports', () => {
    renderDashboard(sample);
    expect(screen.getByRole('heading', { name: 'Trésorerie' })).toBeInTheDocument();
    expect(screen.getByText('Blanchi sur la période')).toBeInTheDocument();
    expect(normalize(screen.getByText(/dont .* en argent sale/).textContent)).toBe('dont 118 000 $ en argent sale');
    expect(normalize(screen.getByText(/engagés · commission/).textContent)).toBe('90 000 $ engagés · commission 27 000 $');
    expect(screen.getByText('Évolution de la trésorerie')).toBeInTheDocument();
  });

  it('donne accès aux chiffres exacts sous forme de tableau', async () => {
    renderDashboard(sample);
    const panel = screen.getByText('Encaissements par moyen de paiement').closest('section')!;
    await userEvent.click(within(panel).getByRole('button', { name: 'Tableau' }));
    const row = within(panel).getByRole('row', { name: /Espèces/ });
    expect(normalize(row.textContent)).toBe('EspècesArgent propre24 000 $');
  });

  it('remplace la trésorerie par le solde de caisse pour un rôle sans accès aux finances', () => {
    renderDashboard({ ...sample, treasury: null });
    expect(screen.queryByRole('heading', { name: 'Trésorerie' })).not.toBeInTheDocument();
    expect(screen.getByText('Solde de caisse')).toBeInTheDocument();
  });
});
