import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import { LabReportStore } from '../../services/lab-report.store';
import { PatientReports } from './patient-reports';

describe('PatientReports preview', () => {
  async function setup(preview = '', role: ActiveRole = 'Patient') {
    const activeRole = signal<ActiveRole>(role);
    const activeAccountId = signal<string | null>('test-patient-01');

    await TestBed.configureTestingModule({
      imports: [PatientReports],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(preview ? { preview } : {})),
          },
        },
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
            activeAccountId: activeAccountId.asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PatientReports);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      activeRole,
      activeAccountId,
      store: fixture.debugElement.injector.get(LabReportStore),
    };
  }

  it('allows access only to a signed-in patient account', async () => {
    const { page, activeRole, activeAccountId } = await setup();

    expect(page.permitted()).toBe(true);

    activeRole.set('Doctor');
    expect(page.permitted()).toBe(false);

    activeRole.set('Patient');
    activeAccountId.set(null);
    expect(page.permitted()).toBe(false);
  });

  it('shows the access restricted state for an unauthorized role', async () => {
    const { fixture, page } = await setup('', 'Doctor');

    expect(page.permitted()).toBe(false);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Access restricted');
    expect(element.textContent).not.toContain('Upload a report');
  });

  it('does not show reports belonging to another patient account', async () => {
    const { page, store } = await setup();

    store.addReport({
      id: 'test-report',
      reference: 'TEST-001',
      uploadRequestReference: null,
      patientId: 'another-patient',
      patientName: 'Another patient',
      labId: '',
      labName: 'Not assigned',
      reportType: 'Blood Test',
      reportDate: '2026-11-20',
      notes: '',
      source: 'patient',
      fileName: 'blood-test.pdf',
      fileType: 'application/pdf',
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      reviewedAt: null,
    });

    expect(page.visibleReports().some((report) => report.id === 'test-report')).toBe(false);
  });

  it('opens and closes the upload form', async () => {
    const { page, fixture } = await setup();

    page.openForm();
    fixture.detectChanges();

    expect(page.formOpen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Upload laboratory report',
    );

    page.closeForm();
    fixture.detectChanges();

    expect(page.formOpen()).toBe(false);
  });

  it('requires report type, date and a document before saving', async () => {
    const { page } = await setup();

    page.openForm();
    page.save();

    expect(page.submitted()).toBe(true);
    expect(page.formError()).toContain('Enter the report type and date');
    expect(page.visibleReports()).toHaveLength(0);
  });

  it('rejects a future report date', async () => {
    const { page } = await setup();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const futureDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');

    page.openForm();
    page.reportType.set('Full Blood Count');
    page.reportDate.set(futureDate);
    page.selectedFiles.set([new File(['report'], 'report.pdf', { type: 'application/pdf' })]);

    page.save();

    expect(page.formError()).toContain('not in the future');
    expect(page.formOpen()).toBe(true);
  });

  it('adds a valid patient report as a local preview after a successful retry', async () => {
    vi.useFakeTimers();

    try {
      const { page } = await setup();

      page.openForm();
      page.reportType.set('Full Blood Count');
      page.reportDate.set('2026-11-20');
      page.reference.set('PATIENT-REF-001');
      page.notes.set('Routine blood test');

      page.selectedFiles.set([
        new File(['report'], 'blood-count.pdf', { type: 'application/pdf' }),
      ]);

      page.detailsConfirmed.set(true);

      page.save();

      expect(page.uploadState()).toBe('uploading');
      expect(page.formOpen()).toBe(true);

      await vi.advanceTimersByTimeAsync(600);

      expect(page.uploadState()).toBe('failed');
      expect(page.formOpen()).toBe(true);
      expect(page.visibleReports()).toHaveLength(0);

      page.retryUpload();

      expect(page.uploadState()).toBe('uploading');

      await vi.advanceTimersByTimeAsync(1200);

      expect(page.uploadState()).toBe('complete');
      expect(page.formOpen()).toBe(false);
      expect(page.visibleReports()).toHaveLength(1);

      const report = page.visibleReports()[0];

      expect(report.patientId).toBe('test-patient-01');
      expect(report.reportType).toBe('Full Blood Count');
      expect(report.fileName).toBe('blood-count.pdf');
      expect(report.uploadRequestReference).toBeNull();
      expect(report.labId).toBe('');
      expect(report.status).toBe('pending');
      expect(page.message()).toContain('added locally');
      expect(page.message()).toContain('or uploaded to the server');
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks upload while the page is loading', async () => {
    const { page } = await setup('loading');

    expect(page.canUpload()).toBe(false);

    page.openForm();

    expect(page.formOpen()).toBe(false);
  });

  it('blocks upload in an error preview and restores the page after retry', async () => {
    const { page, fixture } = await setup('error');

    expect(page.canUpload()).toBe(false);

    page.retry();
    fixture.detectChanges();

    expect(page.pageState()).toBe('ready');
    expect(page.canUpload()).toBe(true);
  });

  it('does not allow uploads when access is denied', async () => {
    const { page } = await setup('denied');

    expect(page.permitted()).toBe(true);
    expect(page.canUpload()).toBe(false);

    page.openForm();

    expect(page.formOpen()).toBe(false);
  });
});
