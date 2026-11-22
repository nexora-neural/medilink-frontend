import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { VaccinationDraft } from '../models/vaccination.model';
import { VaccinationStore } from './vaccination-store';

describe('VaccinationStore', () => {
  const draft: VaccinationDraft = {
    vaccineName: 'Hepatitis B',
    administeredOn: '2025-10-20',
    doseDetails: 'Second dose',
    nextDoseOn: '2026-04-20',
    source: 'doctor',
    notes: 'Sample vaccination',
  };

  let store: VaccinationStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VaccinationStore],
    });

    store = TestBed.inject(VaccinationStore);
  });

  it('starts with the mock vaccination records', () => {
    expect(store.current()).toHaveLength(2);
    expect(store.history()).toEqual([]);
    expect(store.totalCount()).toBe(2);
  });

  it('loads the existing mock records', async () => {
    await store.load();

    expect(store.current()).toHaveLength(2);
    expect(store.current()[0].vaccineName).toBe('COVID-19');
  });

  it('adds a vaccination with an active consultation', async () => {
    const result = await store.add(draft, 'consultation-001');

    expect(result).toEqual({ refreshed: true });
    expect(store.current()).toHaveLength(3);
    expect(store.current()[0].vaccineName).toBe('Hepatitis B');
    expect(store.current()[0].supersedesId).toBeNull();
  });

  it('rejects adding a vaccination without a consultation', async () => {
    await expect(store.add(draft, '   ')).rejects.toThrow(
      'An active consultation is required to add a vaccination.',
    );

    expect(store.current()).toHaveLength(2);
  });

  it('rejects an empty vaccine name', async () => {
    const invalidDraft = {
      ...draft,
      vaccineName: '   ',
    };

    await expect(store.add(invalidDraft, 'consultation-001')).rejects.toThrow(
      'Enter the vaccine name.',
    );
  });

  it('rejects a future vaccination date', async () => {
    const invalidDraft = {
      ...draft,
      administeredOn: '2099-01-01',
    };

    await expect(store.add(invalidDraft, 'consultation-001')).rejects.toThrow(
      'Vaccination date cannot be in the future.',
    );
  });

  it('rejects a next-dose date before the administered date', async () => {
    const invalidDraft = {
      ...draft,
      nextDoseOn: '2025-01-01',
    };

    await expect(store.add(invalidDraft, 'consultation-001')).rejects.toThrow(
      'Next-dose date cannot be before the vaccination date.',
    );
  });

  it('rejects non-doctor vaccination entries', async () => {
    const invalidDraft = {
      ...draft,
      source: 'patient' as const,
    };

    await expect(store.add(invalidDraft, 'consultation-001')).rejects.toThrow(
      'Only doctors can add vaccination records here.',
    );
  });

  it('corrects a vaccination and preserves the original in history', async () => {
    const original = store.current()[0];

    const correctionDraft: VaccinationDraft = {
      ...draft,
      vaccineName: 'COVID-19',
      administeredOn: '2025-06-15',
      doseDetails: 'Corrected booster dose',
      nextDoseOn: null,
    };

    await store.correct(original.id, correctionDraft, 'Corrected dose details', 'consultation-001');

    expect(store.current()).toHaveLength(2);
    expect(store.history()).toContainEqual(original);

    const corrected = store.current()[0];

    expect(corrected.vaccineName).toBe('COVID-19');
    expect(corrected.supersedesId).toBe(original.id);
    expect(corrected.correctionReason).toBe('Corrected dose details');
    expect(store.totalCount()).toBe(3);
  });

  it('rejects a correction without a consultation', async () => {
    const original = store.current()[0];

    await expect(store.correct(original.id, draft, 'Correction reason', '  ')).rejects.toThrow(
      'An active consultation is required to correct a vaccination.',
    );

    expect(store.history()).toEqual([]);
  });

  it('rejects an empty correction reason', async () => {
    const original = store.current()[0];

    await expect(store.correct(original.id, draft, '   ', 'consultation-001')).rejects.toThrow(
      'Enter a correction reason of 1-500 characters.',
    );

    expect(store.history()).toEqual([]);
  });

  it('rejects correcting an unknown vaccination', async () => {
    await expect(
      store.correct('unknown-vaccination', draft, 'Correction reason', 'consultation-001'),
    ).rejects.toThrow('Only an active vaccination record can be corrected.');
  });

  it('returns linked vaccination versions', async () => {
    const original = store.current()[0];

    const correctionDraft: VaccinationDraft = {
      ...draft,
      vaccineName: original.vaccineName,
      administeredOn: original.administeredOn,
      doseDetails: 'Updated dose details',
      nextDoseOn: null,
    };

    await store.correct(original.id, correctionDraft, 'Updated details', 'consultation-001');

    const versions = store.versionsFor(original.id);

    expect(versions).toHaveLength(1);
    expect(versions[0].supersedesId).toBe(original.id);
    expect(versions[0].doseDetails).toBe('Updated dose details');
  });
});
