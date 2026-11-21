import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  draftProblems,
  PrescriptionDraftInput,
  PrescriptionDraftPreviewStore,
} from './prescription-draft-preview.store';

describe('PrescriptionDraftPreviewStore', () => {
  let store: PrescriptionDraftPreviewStore;

  function validInput(): PrescriptionDraftInput {
    const draft = store.find('sample-draft-01');

    if (!draft) throw new Error('Sample draft is missing.');

    return {
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      items: draft.items,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PrescriptionDraftPreviewStore],
    });

    store = TestBed.inject(PrescriptionDraftPreviewStore);
  });

  it('saves edits to the owner draft without changing its identity or authority', () => {
    const original = store.find('sample-draft-01')!;
    const input = validInput();
    input.items[0].instructions = '  Updated synthetic instructions.  ';

    const saved = store.save(original.id, input);

    expect(saved.items[0].instructions).toBe('Updated synthetic instructions.');
    expect(store.find(original.id)).toEqual(saved);
    expect(saved.id).toBe(original.id);
    expect(saved.ownerDoctorId).toBe(original.ownerDoctorId);
    expect(saved.patientReference).toBe(original.patientReference);
    expect(saved.consultationId).toBe(original.consultationId);
    expect(saved.source).toBe(original.source);
    expect(saved.status).toBe('draft');
    expect(saved.createdAt).toBe(original.createdAt);
  });

  it.each(['sample-other-owner-01', 'sample-active-01', 'unknown-id'])(
    'rejects editing %s without changing stored prescriptions',
    (id) => {
      const before = store.list();

      expect(() => store.save(id, validInput())).toThrow(
        'Only the owner doctor can edit a doctor-source draft.',
      );

      expect(store.list()).toEqual(before);
    },
  );

  it('does not expose stored objects through reads or save results', () => {
    const input = validInput();
    const saved = store.save('sample-draft-01', input);
    const list = store.list();
    const found = store.find('sample-draft-01')!;

    input.items[0].medicineName = 'Changed through input';
    saved.items[0].medicineName = 'Changed through save result';
    list[0].items[0].medicineName = 'Changed through list';
    found.items[0].medicineName = 'Changed through detail';

    expect(store.find('sample-draft-01')!.items[0].medicineName).toBe('Sample medicine A');
  });

  it('returns null for an unknown prescription', () => {
    expect(store.find('unknown-id')).toBeNull();
  });

  it('rejects a draft with no medicines and preserves saved data', () => {
    const before = store.list();
    const input = validInput();
    input.items = [];

    expect(() => store.save('sample-draft-01', input)).toThrow('Add at least one medicine.');
    expect(store.list()).toEqual(before);
  });

  it.each([
    ['2026-02-30', '2026-03-03'],
    ['not-a-date', '2026-11-23'],
    ['2026-11-23', '2026-11-21'],
    ['', '2026-11-23'],
  ])('rejects invalid date range %s to %s', (startsOn, endsOn) => {
    const input = validInput();
    input.startsOn = startsOn;
    input.endsOn = endsOn;

    expect(draftProblems(input)).toContain('Enter valid start and end dates in the correct order.');
  });

  it('rejects blank required medicine fields', () => {
    const input = validInput();
    input.items[0].medicineName = '   ';
    input.items[0].dose = '';
    input.items[0].route = '';
    input.items[0].frequency = '';

    expect(draftProblems(input)).toContain(
      'Medicine 1: complete medicine, dose, route and frequency.',
    );
  });

  it('rejects duplicate medicine item identities', () => {
    const input = validInput();
    input.items[1].id = input.items[0].id;

    expect(draftProblems(input)).toContain('Medicine 2: item identity must be unique.');
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid duration %s', (duration) => {
    const input = validInput();
    input.items[0].durationDays = duration;

    expect(draftProblems(input)).toContain('Medicine 1: duration must be a positive whole number.');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid quantity %s',
    (quantity) => {
      const input = validInput();
      input.items[0].quantity = quantity;

      expect(draftProblems(input)).toContain(
        'Medicine 1: enter a positive quantity and select a unit.',
      );
    },
  );

  it('rejects an unsupported quantity unit', () => {
    const input = validInput();
    input.items[0].quantityUnit = 'unsupported';

    expect(draftProblems(input)).toContain(
      'Medicine 1: enter a positive quantity and select a unit.',
    );
  });

  it('rejects instructions longer than 2000 characters', () => {
    const input = validInput();
    input.items[0].instructions = 'a'.repeat(2001);

    expect(draftProblems(input)).toContain(
      'Medicine 1: instructions cannot exceed 2000 characters.',
    );
  });

  it('resets preview changes to the original samples', () => {
    const original = store.list();
    const input = validInput();
    input.items[0].instructions = 'Changed synthetic instructions.';

    store.save('sample-draft-01', input);
    store.reset();

    expect(store.list()).toEqual(original);
  });
});
