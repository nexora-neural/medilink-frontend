import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth.service';
import { ReportApi, ReportAttempt } from './report-api.service';

describe('ReportApi', () => {
  const auth = {
    postAuthorizedForm: vi.fn(),
    postAuthorizedWithKey: vi.fn(),
    getAuthorized: vi.fn(),
    getAuthorizedBlob: vi.fn(),
  };
  let api: ReportApi;
  const attempt = (): ReportAttempt => ({
    key: 'same-publication-key',
    input: {
      patientId: 'patient-1',
      file: new File(['report'], 'report.pdf'),
      reportType: 'FBC',
      reportDate: '2026-11-20',
      notes: 'Test',
    },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    api = TestBed.inject(ReportApi);
  });

  it('reuses the staged document and key after a lost publication response', async () => {
    const draft = attempt();
    auth.postAuthorizedForm.mockResolvedValue({ id: 'doc-1' });
    auth.postAuthorizedWithKey
      .mockRejectedValueOnce(new Error('Network lost'))
      .mockResolvedValue({ id: 'saved-1' });
    await expect(api.upload(draft, () => true)).rejects.toThrow();
    await expect(api.upload(draft, () => true)).resolves.toEqual({ id: 'saved-1' });
    expect(auth.postAuthorizedForm).toHaveBeenCalledTimes(1);
    const calls = auth.postAuthorizedWithKey.mock.calls;
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0][1]).not.toHaveProperty('source');
    expect(calls[0][1]).not.toHaveProperty('lab_reference');
    const form = auth.postAuthorizedForm.mock.calls[0][1] as FormData;
    expect(form.get('stage_for_report')).toBeNull();
    expect(form.get('upload_request_id')).toBeNull();
  });

  it('binds both document and publication to the resolved laboratory request', async () => {
    const draft = attempt();
    draft.input.requestId = 'request-1';
    draft.input.labReference = 'LAB-42';
    auth.postAuthorizedForm.mockResolvedValue({ id: 'doc-1' });
    auth.postAuthorizedWithKey.mockResolvedValue({ id: 'saved-1' });
    await api.upload(draft, () => true);
    expect((auth.postAuthorizedForm.mock.calls[0][1] as FormData).get('upload_request_id')).toBe(
      'request-1',
    );
    expect((auth.postAuthorizedForm.mock.calls[0][1] as FormData).get('stage_for_report')).toBe(
      'true',
    );
    expect(auth.postAuthorizedWithKey.mock.calls[0][1]).toMatchObject({
      upload_request_id: 'request-1',
      lab_reference: 'LAB-42',
    });
  });

  it.each([null, '', '   '])('serializes an unavailable date as null: %s', async (reportDate) => {
    const draft = attempt();
    draft.input.reportDate = reportDate;
    auth.postAuthorizedForm.mockResolvedValue({ id: 'doc-1' });
    auth.postAuthorizedWithKey.mockResolvedValue({ id: 'saved-1' });
    await api.upload(draft, () => true);
    expect(auth.postAuthorizedWithKey.mock.calls[0][1]).toMatchObject({ report_date: null });
  });

  it('stops before publication when the account changes during upload', async () => {
    let current = true;
    auth.postAuthorizedForm.mockImplementation(async () => {
      current = false;
      return { id: 'doc-1' };
    });
    await expect(api.upload(attempt(), () => current)).rejects.toThrow();
    expect(auth.postAuthorizedWithKey).not.toHaveBeenCalled();
  });
});
