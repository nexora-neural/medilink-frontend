import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementApiService } from './measurement-api.service';
import { MeasurementStore } from './measurement-store';

import { MeasurementDraft, MeasurementRecord } from '../models/measurement.model';

describe('MeasurementStore API integration', () => {
  const draft: MeasurementDraft = {
    recordedAt: '2025-10-20T04:00:00Z',
    source: 'patient',
    reading: {
      kind: 'weight',
      value: 64,
      unit: 'kg',
    },
  };

  const original: MeasurementRecord = {
    id: 'measurement-1',
    rootId: 'measurement-1',
    correctsId: null,
    recordedAt: draft.recordedAt,
    createdAt: '2025-10-20T04:05:00Z',
    source: 'patient',
    reading: draft.reading,
    correctionReason: null,
    status: 'active',
  };

  let store: MeasurementStore;

  const api = {
    getPatientId: vi.fn(),
    load: vi.fn(),
    add: vi.fn(),
    correct: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    api.getPatientId.mockResolvedValue('patient-1');

    api.load.mockResolvedValue({
      current: [original],
      history: [original],
      historyUnavailable: false,
    });

    api.add.mockResolvedValue(undefined);
    api.correct.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        MeasurementStore,
        {
          provide: MeasurementApiService,
          useValue: api,
        },
      ],
    });

    store = TestBed.inject(MeasurementStore);
  });

  it('starts with empty records', () => {
    expect(store.current()).toEqual([]);
    expect(store.history()).toEqual([]);
    expect(store.patientAdded()).toBe(0);
  });

  it('loads records from the API', async () => {
    await store.load();

    expect(api.getPatientId).toHaveBeenCalledOnce();
    expect(api.load).toHaveBeenCalledWith('patient-1');

    expect(store.current()).toEqual([original]);
    expect(store.history()).toEqual([original]);
    expect(store.patientAdded()).toBe(1);
  });

  it('adds a measurement and reloads', async () => {
    await store.load();
    await store.add(draft);

    expect(api.add).toHaveBeenCalledWith('patient-1', draft);

    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('rejects adding before loading the patient', async () => {
    await expect(store.add(draft)).rejects.toThrow('Patient record is not loaded.');

    expect(api.add).not.toHaveBeenCalled();
  });

  it('rejects an empty correction reason', async () => {
    await store.load();

    await expect(store.correct(original.id, draft, '   ')).rejects.toThrow();

    expect(api.correct).not.toHaveBeenCalled();
  });

  it('sends a correction through the API', async () => {
    await store.load();

    const correctionDraft: MeasurementDraft = {
      ...draft,
      reading: {
        kind: 'weight',
        value: 65,
        unit: 'kg',
      },
    };

    await store.correct(original.id, correctionDraft, 'Corrected entered weight');

    expect(api.correct).toHaveBeenCalledWith(
      original.id,
      correctionDraft,
      'Corrected entered weight',
      expect.any(String),
    );

    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('rejects correcting an unknown measurement', async () => {
    await store.load();

    await expect(store.correct('unknown-id', draft, 'Correction reason')).rejects.toThrow();

    expect(api.correct).not.toHaveBeenCalled();
  });

  it('rejects superseded measurement corrections', async () => {
    api.load.mockResolvedValue({
      current: [{ ...original, status: 'superseded' }],
      history: [{ ...original, status: 'superseded' }],
    });

    await store.load();

    await expect(store.correct(original.id, draft, 'Another correction')).rejects.toThrow();

    expect(api.correct).not.toHaveBeenCalled();
  });

  it('rejects changing measurement type', async () => {
    await store.load();

    const invalidDraft: MeasurementDraft = {
      ...draft,
      reading: {
        kind: 'glucose',
        value: 110,
        unit: 'mg/dL',
      },
    };

    await expect(
      store.correct(original.id, invalidDraft, 'Wrong measurement type'),
    ).rejects.toThrow();

    expect(api.correct).not.toHaveBeenCalled();
  });

  it('handles API loading errors', async () => {
    api.load.mockRejectedValue(new Error('Backend unavailable'));

    await expect(store.load()).rejects.toThrow('Backend unavailable');

    expect(store.current()).toEqual([]);
  });

  it('does not treat a reload failure as an add failure', async () => {
    await store.load();

    api.load.mockRejectedValueOnce(new Error('Refresh failed'));

    const result = await store.add(draft);

    expect(api.add).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ refreshed: false });
  });

  it('reuses the idempotency key when retrying the same correction', async () => {
    await store.load();

    api.correct.mockRejectedValueOnce(new Error('Network error'));

    await expect(store.correct(original.id, draft, 'Corrected value')).rejects.toThrow(
      'Network error',
    );

    const firstKey = api.correct.mock.calls[0][3];

    await store.correct(original.id, draft, 'Corrected value');

    const secondKey = api.correct.mock.calls[1][3];

    expect(secondKey).toBe(firstKey);
  });

  it('uses a new key when correction details change', async () => {
    await store.load();

    api.correct.mockRejectedValueOnce(new Error('Network error'));

    await expect(store.correct(original.id, draft, 'First reason')).rejects.toThrow(
      'Network error',
    );

    const firstKey = api.correct.mock.calls[0][3];

    await store.correct(original.id, draft, 'Different reason');

    const secondKey = api.correct.mock.calls[1][3];

    expect(secondKey).not.toBe(firstKey);
  });
});
