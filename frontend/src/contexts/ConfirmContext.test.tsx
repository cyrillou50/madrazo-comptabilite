import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConfirmProvider, useConfirm } from './ConfirmContext';

function CancelButton() {
  const { prompt } = useConfirm();
  const [result, setResult] = useState('aucun');
  return <><button type="button" onClick={async () => setResult(String(await prompt({ title: 'Annuler la vente ?', label: 'Motif', minLength: 3, confirmLabel: 'Annuler la vente' })))}>Ouvrir</button><output>{result}</output></>;
}

describe('boîtes de dialogue', () => {
  it('demande un motif dans une fenêtre du site au lieu du navigateur', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><CancelButton /></ConfirmProvider>);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.getByRole('dialog', { name: 'Annuler la vente ?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler la vente' }));
    expect(screen.getByText('3 caractères minimum.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motif'), 'Client injoignable');
    await user.click(screen.getByRole('button', { name: 'Annuler la vente' }));
    expect(screen.getByRole('status')).toHaveTextContent('Client injoignable');
  });

  it('renvoie null quand on ferme sans valider', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><CancelButton /></ConfirmProvider>);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('null');
  });
});
