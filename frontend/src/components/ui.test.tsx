import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { Input, Modal, Select } from './ui';

function EditForm({ values }: { values: { name: string; status: string } }) {
  const { register, reset } = useForm({ defaultValues: { name: '', status: 'actif' } });
  useEffect(() => { reset(values); }, [reset, values]);
  return <form><Input label="Nom" {...register('name')} /><Select label="Statut" {...register('status')}><option value="actif">Actif</option><option value="vip">VIP</option></Select></form>;
}

describe('champs de formulaire', () => {
  it('affiche les valeurs d’une fiche à modifier (ref transmise à react-hook-form)', () => {
    render(<EditForm values={{ name: 'Los Reyes', status: 'vip' }} />);
    expect(screen.getByLabelText('Nom')).toHaveValue('Los Reyes');
    expect(screen.getByLabelText('Statut')).toHaveValue('vip');
  });
});

describe('fenêtres modales', () => {
  it('s’affichent à la racine du document, hors d’un conteneur animé', () => {
    render(<div data-testid="page" style={{ transform: 'translateY(0)' }}><Modal open onClose={() => undefined} title="Nouvelle vente"><p>Contenu</p></Modal></div>);
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle vente' });
    expect(screen.getByTestId('page')).not.toContainElement(dialog);
    expect(screen.getByRole('heading', { name: 'Nouvelle vente' })).toBeVisible();
  });

  it('Échap ne ferme que la fenêtre du dessus', async () => {
    const closeBase = vi.fn();
    const closeTop = vi.fn();
    render(<><Modal open onClose={closeBase} title="Commande"><p>Détail</p></Modal><Modal open onClose={closeTop} title="Confirmation" layer="top"><p>Sûr ?</p></Modal></>);
    await userEvent.keyboard('{Escape}');
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBase).not.toHaveBeenCalled();
  });
});
