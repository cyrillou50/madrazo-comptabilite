import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';

describe('DataTable', () => {
  it('annonce un état vide explicite', () => {
    render(<DataTable<{ id: number }> rows={[]} rowKey={(row) => row.id} columns={[]} emptyTitle="Aucune vente" emptyDescription="Créez une première commande." />);
    expect(screen.getByText('Aucune vente')).toBeInTheDocument();
    expect(screen.getByText('Créez une première commande.')).toBeInTheDocument();
  });

  it('rend les colonnes et les valeurs', () => {
    render(<DataTable rows={[{ id: 1, name: 'Los Reyes' }]} rowKey={(row) => row.id} columns={[{ key: 'name', label: 'Groupe', render: (row) => row.name }]} />);
    expect(screen.getByRole('columnheader', { name: 'Groupe' })).toBeInTheDocument();
    expect(screen.getByText('Los Reyes')).toBeInTheDocument();
  });
});
