import { describe, expect, it } from 'vitest';
import { describeActivity } from './activity';
import { launderedAmount, launderingFee } from './treasury';

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('calcul du blanchiment', () => {
  it('déduit la commission de l’argent sale engagé', () => {
    expect(launderedAmount(10_000, 20)).toBe(8_000);
    expect(launderedAmount(10_000, 0)).toBe(10_000);
    expect(launderedAmount(1_000, 33.3)).toBe(667);
  });

  it('retrouve la commission quand l’argent propre est saisi à la main', () => {
    expect(launderingFee(10_000, 7_000)).toBe(30);
    expect(launderingFee(0, 7_000)).toBe(0);
  });
});

describe('journal de trésorerie', () => {
  it('décrit un apport et un blanchiment en toutes lettres', () => {
    const deposit = describeActivity({ action: 'treasury.deposit_created', entityType: 'treasury_operation', afterData: { label: 'Apport du Patron', fund: 'dirty', amount: 50_000 } });
    expect(deposit.label).toBe('Argent ajouté');
    expect(normalize(deposit.sentence)).toBe('a ajouté 50 000 $ en argent sale');
    expect(deposit.to).toBe('/finances');

    const laundering = describeActivity({ action: 'treasury.laundering_created', entityType: 'treasury_operation', afterData: { dirtyAmountCents: 1_000_000, cleanAmountCents: 800_000, feeCents: 200_000 } });
    expect(laundering.label).toBe('Argent blanchi');
    expect(normalize(laundering.sentence)).toBe('a blanchi 10 000 $ d’argent sale (8 000 $ d’argent propre obtenus)');
    expect(normalize(laundering.detail)).toBe('10 000 $ sale → 8 000 $ propre · commission 2 000 $');
  });
});
