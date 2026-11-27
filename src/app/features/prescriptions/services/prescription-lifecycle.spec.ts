import { beforeEach, describe, expect, it } from 'vitest';
import { PrescriptionDraftPreviewStore } from './prescription-draft-preview.store';

describe('Prescription lifecycle preview', () => {
  let store: PrescriptionDraftPreviewStore;

  beforeEach(() => {
    store = new PrescriptionDraftPreviewStore();
  });

  it.each([
    ['complete', 'completed'],
    ['cancel', 'cancelled'],
    ['discontinue', 'discontinued'],
  ] as const)('%s records status and reason', (action, status) => {
    const updated = store.finish('sample-active-01', action, ' QA reason ');

    expect(updated.status).toBe(status);
    expect(updated.history?.at(-1)).toMatchObject({
      action,
      reason: 'QA reason',
      performedBy: 'sample-doctor-01',
    });
    expect(store.find(updated.id)?.status).toBe(status);
  });

  it('rejects blank reasons without changing data', () => {
    const before = store.list();

    expect(() => store.finish('sample-active-01', 'cancel', '   ')).toThrow();

    expect(store.list()).toEqual(before);
  });

  it('rejects reasons longer than 1000 characters', () => {
    expect(() => store.finish('sample-active-01', 'cancel', 'x'.repeat(1001))).toThrow();

    expect(store.find('sample-active-01')?.status).toBe('active');
  });

  it('rejects repeated terminal actions', () => {
    store.finish('sample-active-01', 'cancel', 'QA cancellation');

    expect(() => store.finish('sample-active-01', 'complete', 'QA completion')).toThrow();

    expect(store.find('sample-active-01')?.history).toHaveLength(1);
  });

  it('rejects another doctor’s prescription', () => {
    const before = store.list();

    expect(() => store.finish('sample-other-owner-01', 'cancel', 'QA reason')).toThrow();

    expect(() => store.createLinkedDraft('sample-other-owner-01', 'renew', 'QA reason')).toThrow();

    expect(store.list()).toEqual(before);
  });

  it.each(['correct', 'renew', 'reissue'] as const)(
    '%s creates a linked draft and preserves original medicines',
    (action) => {
      const original = store.find('sample-active-01')!;
      const draft = store.createLinkedDraft(original.id, action, 'QA linked reason');

      expect(draft.status).toBe('draft');
      expect(draft.version).toBe(2);
      expect(draft.previousPrescriptionId).toBe(original.id);
      expect(draft.history?.[0].relatedPrescriptionId).toBe(original.id);

      const changedItems = structuredClone(draft.items);
      changedItems[0].instructions = 'QA changed instructions';

      store.save(draft.id, {
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        items: changedItems,
      });

      const preserved = store.find(original.id)!;

      expect(preserved.status).toBe('active');
      expect(preserved.items).toEqual(original.items);
      expect(preserved.history?.at(-1)).toMatchObject({
        action,
        reason: 'QA linked reason',
        relatedPrescriptionId: draft.id,
      });
      expect(store.find(draft.id)?.items[0].instructions).toBe('QA changed instructions');
    },
  );

  it('blocks duplicate linked drafts', () => {
    store.createLinkedDraft('sample-active-01', 'correct', 'QA first draft');
    const before = store.list();

    expect(() => store.createLinkedDraft('sample-active-01', 'renew', 'QA second draft')).toThrow();

    expect(store.list()).toEqual(before);
  });

  it('rejects blank linked-draft reasons', () => {
    const before = store.list();

    expect(() => store.createLinkedDraft('sample-active-01', 'correct', '   ')).toThrow();

    expect(store.list()).toEqual(before);
  });

  it('prevents changes to a superseded prescription', () => {
    const before = store.list();

    expect(() => store.finish('sample-superseded-01', 'cancel', 'QA reason')).toThrow();

    expect(() => store.createLinkedDraft('sample-superseded-01', 'correct', 'QA reason')).toThrow();

    expect(store.list()).toEqual(before);
  });

  it('links the superseded sample to its replacement', () => {
    const previous = store.find('sample-superseded-01')!;
    const replacement = store.find('sample-replacement-01')!;

    expect(previous.status).toBe('superseded');
    expect(previous.history?.[0].relatedPrescriptionId).toBe(replacement.id);
    expect(replacement.status).toBe('active');
    expect(replacement.previousPrescriptionId).toBe(previous.id);
    expect(replacement.version).toBe(2);
  });
});
