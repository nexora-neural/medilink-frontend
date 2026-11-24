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

    expect(store.history()[0].notes).toBe('Sample vaccination record');
    expect(store.history()[0].nextDoseOn).toBeNull();
  });

  it('preserves the original next-dose date when a vaccination is corrected', async () => {
    const original = store.current()[1];

    expect(original.nextDoseOn).toBe('2026-10-10');

    const correctionDraft: VaccinationDraft = {
      ...draft,
      vaccineName: original.vaccineName,
      administeredOn: original.administeredOn,
      doseDetails: 'Updated annual dose',
      nextDoseOn: null,
    };

    await store.correct(
      original.id,
      correctionDraft,
      'Updated annual dose details',
      'consultation-001',
    );

    const previousVersion = store.history().find((record) => record.id === original.id);

    expect(previousVersion).toBeDefined();
    expect(previousVersion?.nextDoseOn).toBe('2026-10-10');
    expect(previousVersion?.doseDetails).toBe('Annual dose');
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

  it('groups successive corrections separately for records with the same vaccine name', async () => {
    const firstOriginal = store.current()[0];

    // Create a second independent COVID-19 vaccination record.
    await store.add(
      {
        ...draft,
        vaccineName: 'COVID-19',
        administeredOn: '2025-07-15',
        doseDetails: 'Second booster dose',
        nextDoseOn: null,
        notes: 'Independent second COVID-19 record',
      },
      'consultation-001',
    );

    const secondOriginal = store
      .current()
      .find((record) => record.id !== firstOriginal.id && record.vaccineName === 'COVID-19');

    expect(secondOriginal).toBeDefined();

    if (!secondOriginal) {
      throw new Error('Second COVID-19 record was not created.');
    }

    // First record: Original -> First correction.
    await store.correct(
      firstOriginal.id,
      {
        ...draft,
        vaccineName: 'COVID-19',
        administeredOn: firstOriginal.administeredOn,
        doseDetails: 'First correction',
        nextDoseOn: null,
      },
      'First correction reason',
      'consultation-001',
    );

    const firstCorrection = store
      .current()
      .find((record) => record.supersedesId === firstOriginal.id);

    expect(firstCorrection).toBeDefined();

    if (!firstCorrection) {
      throw new Error('First correction was not created.');
    }

    // First record: Original -> First correction -> Second correction.
    await store.correct(
      firstCorrection.id,
      {
        ...draft,
        vaccineName: 'COVID-19',
        administeredOn: firstOriginal.administeredOn,
        doseDetails: 'Second correction',
        nextDoseOn: null,
      },
      'Second correction reason',
      'consultation-001',
    );

    const firstLatest = store
      .current()
      .find((record) => record.supersedesId === firstCorrection.id);

    expect(firstLatest).toBeDefined();

    if (!firstLatest) {
      throw new Error('Second correction was not created.');
    }

    // Second independent record: Original -> Correction.
    await store.correct(
      secondOriginal.id,
      {
        ...draft,
        vaccineName: 'COVID-19',
        administeredOn: secondOriginal.administeredOn,
        doseDetails: 'Second record correction',
        nextDoseOn: null,
      },
      'Second record correction reason',
      'consultation-001',
    );

    const secondLatest = store
      .current()
      .find((record) => record.supersedesId === secondOriginal.id);

    expect(secondLatest).toBeDefined();

    if (!secondLatest) {
      throw new Error('Second record correction was not created.');
    }

    // First chain must contain only its own previous versions.
    const firstChain = store.previousVersionsFor(firstLatest.id);

    expect(firstChain.map((record) => record.id)).toEqual([firstCorrection.id, firstOriginal.id]);

    expect(firstChain.map((record) => record.doseDetails)).toEqual([
      'First correction',
      firstOriginal.doseDetails,
    ]);

    // Second chain must contain only its own original record.
    const secondChain = store.previousVersionsFor(secondLatest.id);

    expect(secondChain.map((record) => record.id)).toEqual([secondOriginal.id]);

    expect(secondChain.map((record) => record.doseDetails)).toEqual(['Second booster dose']);

    // Both current records have the same name but remain separate.
    expect(firstLatest.vaccineName).toBe(secondLatest.vaccineName);
    expect(firstLatest.id).not.toBe(secondLatest.id);

    // The chains must never contain each other's records.
    expect(firstChain.some((record) => record.id === secondOriginal.id)).toBe(false);

    expect(
      secondChain.some(
        (record) => record.id === firstOriginal.id || record.id === firstCorrection.id,
      ),
    ).toBe(false);
  });

  it('returns no previous versions for an unknown current record', () => {
    expect(store.previousVersionsFor('unknown-record')).toEqual([]);
  });
});
