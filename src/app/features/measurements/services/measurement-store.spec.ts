import { MeasurementStore } from './measurement-store';
import { MeasurementDraft } from '../models/measurement.model';

describe('MeasurementStore', () => {
  const draft: MeasurementDraft = {
    recordedAt: '2026-10-20T04:00:00Z',
    source: 'patient',
    reading: { kind: 'weight', value: 64, unit: 'kg' },
  };

  it('preserves the original and links successive corrections', () => {
    const store = new MeasurementStore();
    const original = store.add(draft);
    const snapshot = structuredClone(original);

    const corrected = store.correct(
      original.id,
      {
        ...draft,
        reading: { kind: 'weight', value: 65, unit: 'kg' },
      },
      'Corrected the entered value',
    );

    expect(store.history().find((item) => item.id === original.id)).toEqual(snapshot);
    expect(corrected.correctsId).toBe(original.id);
    expect(corrected.rootId).toBe(original.id);
    expect(store.current().some((item) => item.id === original.id)).toBe(false);
    expect(store.current()).toContainEqual(corrected);

    const latest = store.correct(
      corrected.id,
      {
        ...draft,
        reading: { kind: 'weight', value: 66, unit: 'kg' },
      },
      'Second correction',
    );

    expect(latest.correctsId).toBe(corrected.id);
    expect(store.revisionsFor(original.id)).toEqual([latest, corrected, original]);

    expect(() => store.correct(original.id, draft, 'Outdated correction')).toThrowError(
      'Only the latest version of a measurement can be corrected.',
    );
  });

  it('rejects invalid measurements and blank correction reasons', () => {
    const store = new MeasurementStore();
    const initialCount = store.history().length;

    expect(() =>
      store.add({
        ...draft,
        reading: { kind: 'weight', value: -1, unit: 'kg' },
      }),
    ).toThrow();

    expect(store.history().length).toBe(initialCount);

    const original = store.add(draft);

    expect(() => store.correct(original.id, draft, '   ')).toThrowError(
      'Enter a correction reason of 1–500 characters.',
    );

    expect(store.revisionsFor(original.id)).toEqual([original]);
  });
});
