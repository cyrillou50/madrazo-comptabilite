import { afterEach, describe, expect, it } from 'vitest';
import { currency, currencySymbol, setCurrencyCode, statusTone } from './format';

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('affichage de la devise', () => {
  afterEach(() => setCurrencyCode('USD'));

  it('n’affiche que le symbole $, jamais « $US »', () => {
    expect(normalize(currency(1250))).toBe('1 250 $');
    expect(currency(1250)).not.toContain('US');
    expect(currencySymbol()).toBe('$');
  });

  it('suit le paramètre de devise', () => {
    setCurrencyCode('EUR');
    expect(normalize(currency(1250))).toBe('1 250 €');
    expect(currencySymbol()).toBe('€');
  });
});

describe('couleur des statuts', () => {
  it('distingue les paiements partiels ou absents d’un paiement complet', () => {
    expect(statusTone('Payé')).toBe('success');
    expect(statusTone('Partiellement payé')).toBe('warning');
    expect(statusTone('Non payé')).toBe('danger');
    expect(statusTone('Inactif')).toBe('danger');
    expect(statusTone('Actif')).toBe('success');
  });
});
