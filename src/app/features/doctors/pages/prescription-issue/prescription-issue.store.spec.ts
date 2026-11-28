import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PrescriptionDraftPreviewStore } from '../../../prescriptions/services/prescription-draft-preview.store';
import { PrescriptionIssuePreviewStore } from './prescription-issue.store';

describe('PrescriptionIssuePreviewStore renewal integration', () => {
  let drafts: PrescriptionDraftPreviewStore;
  let issues: PrescriptionIssuePreviewStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PrescriptionDraftPreviewStore, PrescriptionIssuePreviewStore],
    });
    drafts = TestBed.inject(PrescriptionDraftPreviewStore);
    issues = TestBed.inject(PrescriptionIssuePreviewStore);
  });

  it('loads the actual local renewal draft with synthetic-only warnings', async () => {
    const draft = drafts.createLinkedDraft(
      'sample-active-01',
      'renew',
      'Synthetic renewal preview test.',
    );

    const review = await issues.load(draft.id);
    expect(review?.id).toBe(draft.id);
    expect(review?.status).toBe('draft');
    expect(review?.items).toEqual(draft.items);
    expect(review?.warnings.join(' ')).toContain('does not clinically verify');
  });

  it('changes only the preview draft to active after explicit issue confirmation', async () => {
    const source = drafts.find('sample-active-01')!;
    const draft = drafts.createLinkedDraft(source.id, 'renew', 'Synthetic renewal preview test.');

    const issued = await issues.issue(draft.id);
    expect(issued.status).toBe('active');
    expect(drafts.find(draft.id)?.status).toBe('active');
    expect(drafts.find(source.id)?.status).toBe('active');
  });

  it('rejects issuing another doctor’s local draft', async () => {
    await expect(issues.issue('sample-other-owner-01')).rejects.toThrow(
      'Only the owner doctor can issue an editable sample draft.',
    );
    expect(drafts.find('sample-other-owner-01')?.status).toBe('draft');
  });

  it('does not expose a renewal action for a completed prescription', async () => {
    drafts.finish('sample-active-01', 'complete', 'Synthetic completion preview.');

    const review = await issues.load('sample-active-01');
    expect(review?.status).toBe('completed');
    await expect(issues.issue('sample-active-01')).rejects.toThrow();
    expect(drafts.find('sample-active-01')?.status).toBe('completed');
  });
});
