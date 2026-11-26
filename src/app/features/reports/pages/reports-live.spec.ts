import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { ActiveOrganizationService } from '../../../core/context/active-organization.service';
import { LabUploadRequestApi } from '../../lab-upload-requests/services/lab-upload-request-api.service';
import { ReportApi } from '../services/report-api.service';
import type { ReportAttempt } from '../services/report-api.service';
import { ReportsLive } from './reports-live';

describe('ReportsLive', () => {
  const account = signal('patient-1');
  const role = signal('Patient');
  const api = { list: vi.fn(), upload: vi.fn(), download: vi.fn() };
  const response = (id: string) => ({ items: [{ id }], page: 1, total: 1 });

  beforeEach(() => {
    vi.resetAllMocks();
    account.set('patient-1');
    role.set('Patient');
    api.list.mockResolvedValue(response('saved'));
    TestBed.configureTestingModule({
      imports: [ReportsLive],
      providers: [
        { provide: ReportApi, useValue: api },
        { provide: LabUploadRequestApi, useValue: {} },
        {
          provide: ActiveRoleService,
          useValue: { activeAccountId: account, activeRole: role },
        },
        {
          provide: ActiveOrganizationService,
          useValue: { activeOrganizationId: signal(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { reportAudience: 'patient' } } },
        },
      ],
    });
  });

  it('reloads saved server results on refresh', async () => {
    const fixture = TestBed.createComponent(ReportsLive);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.list).toHaveBeenLastCalledWith('patient-1', 1);
    api.list.mockResolvedValue(response('after-refresh'));
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.reports()[0].id).toBe('after-refresh');
  });

  it('shows denied access and clears old results', async () => {
    const fixture = TestBed.createComponent(ReportsLive);
    fixture.detectChanges();
    await fixture.whenStable();
    api.list.mockRejectedValue(new HttpErrorResponse({ status: 403 }));
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.denied()).toBe(true);
    expect(fixture.componentInstance.reports()).toEqual([]);
  });

  it('keeps the upload form after a service failure and uses the signed-in patient', async () => {
    const fixture = TestBed.createComponent(ReportsLive);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.file = new File(['pdf'], 'test.pdf');
    page.reportType = 'FBC';
    page.reportDate = '2026-01-01';
    api.upload.mockRejectedValue(new Error('Offline'));
    await page.save();
    expect(page.reportType).toBe('FBC');
    expect(page.error()).toContain('retry');
    expect(api.upload.mock.calls[0][0].input.patientId).toBe('patient-1');
  });

  it.each([false, true])(
    'allows a corrected reference and handles a changed file: %s',
    async (changeFile) => {
      role.set('Lab Staff');
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { snapshot: { data: { reportAudience: 'lab' } } },
      });
      TestBed.overrideProvider(ActiveOrganizationService, {
        useValue: { activeOrganizationId: signal('lab-1') },
      });
      const fixture = TestBed.createComponent(ReportsLive);
      fixture.detectChanges();
      await fixture.whenStable();
      const page = fixture.componentInstance;
      page.file = new File(['pdf'], 'test.pdf');
      page.reportType = 'FBC';
      page.reportDate = '2026-01-01';
      page.labReference = 'DUPLICATE';
      page.confirmed = true;
      page.resolved.set({
        request_id: 'request-1',
        laboratory_id: 'lab-1',
        patient: {
          patient_user_id: 'patient-1',
          display_name: 'Test patient',
          date_of_birth: null,
        },
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
      api.upload.mockImplementationOnce(async (attempt: ReportAttempt) => {
        attempt.documentId = 'staged-document';
        throw new HttpErrorResponse({
          status: 409,
          error: {
            code: 'INVALID_STATE',
            message: 'Report reference already exists.',
          },
        });
      });
      await page.save();
      expect(page.locked()).toBe(false);
      expect(page.reportType).toBe('FBC');
      expect(page.resolved()?.request_id).toBe('request-1');
      expect(page.error()).toContain('different reference');
      const first = api.upload.mock.calls[0][0] as ReportAttempt;
      page.labReference = 'CORRECTED';
      if (changeFile) page.file = new File(['replacement'], 'replacement.pdf');
      api.upload.mockResolvedValueOnce({ id: 'saved-report' });
      await page.save();
      const second = api.upload.mock.calls[1][0] as ReportAttempt;
      expect(second.key).not.toBe(first.key);
      expect(second.input.labReference).toBe('CORRECTED');
      expect(second.documentId).toBe(changeFile ? undefined : 'staged-document');
      expect(page.message()).toBe('Report saved.');
    },
  );

  it.each([0, 500, 409])(
    'preserves the frozen publication for an uncertain or other failure: %s',
    async (status) => {
      const fixture = TestBed.createComponent(ReportsLive);
      fixture.detectChanges();
      await fixture.whenStable();
      const page = fixture.componentInstance;
      page.file = new File(['pdf'], 'test.pdf');
      page.reportType = 'FBC';
      page.reportDate = '2026-01-01';
      api.upload.mockImplementationOnce(async (attempt: ReportAttempt) => {
        attempt.documentId = 'staged-document';
        throw new HttpErrorResponse({
          status,
          error: {
            code: 'INVALID_STATE',
            message: 'Upload request is no longer active.',
          },
        });
      });
      await page.save();
      expect(page.locked()).toBe(true);
      const first = api.upload.mock.calls[0][0];
      api.upload.mockResolvedValueOnce({ id: 'saved-report' });
      await page.save();
      expect(api.upload.mock.calls[1][0]).toBe(first);
    },
  );

  it('does not apply a previous account response', async () => {
    let finish!: (value: unknown) => void;
    api.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const fixture = TestBed.createComponent(ReportsLive);
    fixture.detectChanges();
    account.set('patient-2');
    fixture.detectChanges();
    finish(response('private-old-account'));
    await fixture.whenStable();
    expect(fixture.componentInstance.reports()[0].id).toBe('saved');
    expect(api.list).toHaveBeenLastCalledWith('patient-2', 1);
  });
});
