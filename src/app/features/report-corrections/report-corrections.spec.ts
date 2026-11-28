import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../core/context/active-role.service';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { REPORT_CORRECTION_ROUTES } from './report-corrections.routes';
import { ReportCorrectionStore } from './services/report-correction.store';

describe('reference report layouts', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'workspace/lab-staff/reports',
            data: { audience: 'lab' },
            children: REPORT_CORRECTION_ROUTES,
          },
        ]),
      ],
    }),
  );
  function existingUpload(): void {
    TestBed.inject(ActiveRoleService).setAccountRoles('test-lab-user', ['lab_staff']);
    TestBed.inject(ReportCorrectionStore).setReports(
      [
        {
          id: 'LR-1',
          patient: 'Nadeesha Perera',
          request: 'LAB-123',
          type: 'Full blood count',
          date: '2026-11-24',
          reference: 'LAB-123',
          notes: '',
          file: 'report.pdf',
          url: 'blob:original',
          mime: 'application/pdf',
          status: 'Published',
          version: 1,
        },
      ],
      { 'LR-1': { correct: true, withdraw: true } },
    );
  }
  it('renders the reference empty list without invented reports or preview banners', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/lab-staff/reports');
    expect(harness.routeNativeElement?.textContent).toContain(
      'No reports have been published yet.',
    );
    expect(harness.routeNativeElement?.querySelector('.patient-row')).toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('UI preview');
  });
  it('splits the correction fields and confirmation into separate components without adding fields', async () => {
    existingUpload();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/lab-staff/reports/LR-1/correct');
    const host = harness.routeNativeElement!;
    expect(host.querySelector('app-report-correction-fields')).not.toBeNull();
    expect(host.querySelectorAll('input')).toHaveLength(4);
    expect(host.querySelectorAll('textarea')).toHaveLength(2);
    expect(Array.from(host.querySelectorAll('textarea')).map((el) => el.rows)).toEqual([2, 3]);
    const store = TestBed.inject(ReportCorrectionStore);
    store.correctionDraft.file = 'replacement.pdf';
    store.correctionDraft.url = 'blob:new';
    store.correctionReason = 'Correction';
    store.reviewCorrection();
    harness.detectChanges();
    expect(host.querySelector('app-report-correction-confirmation')).not.toBeNull();
    expect(host.querySelectorAll('.panel')).toHaveLength(1);
    expect(host.querySelectorAll('.fields')).toHaveLength(1);
    expect(host.querySelector('.tip')).toBeNull();
  });
  it('keeps the single withdrawal textarea and the original confirmation text', async () => {
    existingUpload();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/lab-staff/reports/LR-1/withdraw');
    const host = harness.routeNativeElement!;
    expect(host.querySelectorAll('textarea')).toHaveLength(1);
    expect(host.querySelector('textarea')?.rows).toBe(3);
    expect(host.querySelector('app-report-withdrawal-reason')).not.toBeNull();
    const store = TestBed.inject(ReportCorrectionStore);
    store.correctionReason = 'Incorrect upload';
    store.reviewWithdrawal();
    harness.detectChanges();
    expect(host.querySelector('app-report-withdrawal-confirmation')?.textContent).toContain(
      'Confirm withdrawal?',
    );
  });
  it('shows the reference missing state instead of inventing a selected report', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/lab-staff/reports/missing/correct');
    expect(harness.routeNativeElement?.textContent).toContain('Select an active report first');
    expect(harness.routeNativeElement?.querySelector('input')).toBeNull();
  });
});
