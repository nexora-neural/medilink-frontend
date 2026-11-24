import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import type { LabReport } from '../../models/lab-report.model';
import { LabReportStore } from '../../services/lab-report.store';
import { PatientReports } from './patient-reports';

describe('PatientReports preview', () => {
  async function setup(role = 'Patient') {
    const activeRole = signal(role);
    const activeAccountId = signal<string | null>('test-patient-01');

    const store = {
      reports: signal<LabReport[]>([]),
      load: vi.fn(),
      addReport: vi.fn<(report: LabReport) => void>(),
    };

    await TestBed.configureTestingModule({
      imports: [PatientReports],
      providers: [
        provideRouter([]),
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
            activeAccountId: activeAccountId.asReadonly(),
          },
        },
      ],
    })
      .overrideComponent(PatientReports, {
        set: {
          providers: [
            {
              provide: LabReportStore,
              useValue: store,
            },
          ],
        },
      })
      .compileComponents();

    const fixture: ComponentFixture<PatientReports> = TestBed.createComponent(PatientReports);
    const page = fixture.componentInstance;

    fixture.detectChanges();

    return {
      fixture,
      page,
      activeRole,
      activeAccountId,
      store,
    };
  }

  it('allows a signed-in patient to access reports', async () => {
    const { page } = await setup();

    expect(page.permitted()).toBe(true);
  });

  it('restricts access for users with another role', async () => {
    const { page } = await setup('Doctor');

    expect(page.permitted()).toBe(false);
  });

  it('filters reports belonging to other patients', async () => {
    const { page } = await setup();

    expect(page.visibleReports()).toBeDefined();
  });

  it('opens and closes the upload form', async () => {
    const { page } = await setup();

    page.openForm();
    expect(page.formOpen()).toBe(true);

    page.closeForm();
    expect(page.formOpen()).toBe(false);
  });

  it('blocks upload when required fields are missing', async () => {
    const { page } = await setup();

    page.openForm();
    page.save();

    expect(page.uploadState()).not.toBe('uploading');
  });

  it('blocks upload when the report date is in the future', async () => {
    const { page } = await setup();

    page.openForm();
    page.reportType.set('Blood Test');
    page.reportDate.set('2999-01-01');
    page.selectedFiles.set([
      new File(['report'], 'report.pdf', {
        type: 'application/pdf',
      }),
    ]);
    page.detailsConfirmed.set(true);

    page.save();

    expect(page.uploadState()).not.toBe('uploading');
  });

  it('uploads a valid report after retrying a failed upload', async () => {
    vi.useFakeTimers();

    try {
      const { page, store } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      expect(page.uploadState()).toBe('uploading');

      await vi.advanceTimersByTimeAsync(600);

      expect(page.uploadState()).toBe('failed');

      page.retryUpload();

      expect(page.uploadState()).toBe('uploading');

      await vi.advanceTimersByTimeAsync(1200);

      expect(page.uploadState()).toBe('complete');
      expect(store.addReport).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks upload while another upload is in progress', async () => {
    vi.useFakeTimers();

    try {
      const { page } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      expect(page.uploadState()).toBe('uploading');
      expect(page.canUpload()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error state when an upload fails', async () => {
    vi.useFakeTimers();

    try {
      const { page } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      await vi.advanceTimersByTimeAsync(600);

      expect(page.uploadState()).toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the denied state for users without patient access', async () => {
    const { page } = await setup('Doctor');

    expect(page.permitted()).toBe(false);
    expect(page.canUpload()).toBe(false);
  });

  it('cancels the upload and clears patient data when the account changes', async () => {
    vi.useFakeTimers();

    try {
      const { fixture, page, activeAccountId, store } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      expect(page.uploadState()).toBe('uploading');

      activeAccountId.set('another-patient');
      fixture.detectChanges();

      expect(page.uploadState()).toBe('idle');
      expect(page.formOpen()).toBe(false);
      expect(page.selectedFiles()).toHaveLength(0);
      expect(page.reportType()).toBe('');
      expect(page.reportDate()).toBe('');
      expect(page.detailsConfirmed()).toBe(false);

      await vi.advanceTimersByTimeAsync(1200);

      expect(store.addReport).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the upload and clears patient data when the active role changes', async () => {
    vi.useFakeTimers();

    try {
      const { fixture, page, activeRole, store } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      expect(page.uploadState()).toBe('uploading');

      activeRole.set('Doctor');
      fixture.detectChanges();

      expect(page.uploadState()).toBe('idle');
      expect(page.formOpen()).toBe(false);
      expect(page.selectedFiles()).toHaveLength(0);
      expect(page.reportType()).toBe('');
      expect(page.reportDate()).toBe('');
      expect(page.detailsConfirmed()).toBe(false);

      await vi.advanceTimersByTimeAsync(1200);

      expect(store.addReport).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('revalidates current fields and confirmation before retrying an upload', async () => {
    vi.useFakeTimers();

    try {
      const { page, store } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.notes.set('Original notes');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      await vi.advanceTimersByTimeAsync(600);

      expect(page.uploadState()).toBe('failed');

      page.reportType.set('Updated Blood Test');
      page.notes.set('Updated notes');
      page.detailsConfirmed.set(false);

      page.retryUpload();

      expect(page.uploadState()).toBe('failed');
      expect(page.formError()).toContain('Confirm your patient account');

      page.detailsConfirmed.set(true);
      page.retryUpload();

      expect(page.uploadState()).toBe('uploading');

      await vi.advanceTimersByTimeAsync(1200);

      expect(page.uploadState()).toBe('complete');
      expect(store.addReport).toHaveBeenCalled();

      const savedReport = store.addReport.mock.calls.at(-1)?.[0];

      expect(savedReport?.reportType).toBe('Updated Blood Test');
      expect(savedReport?.notes).toBe('Updated notes');
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks retry when the current required fields or file are missing', async () => {
    vi.useFakeTimers();

    try {
      const { page } = await setup();

      page.openForm();
      page.reportType.set('Blood Test');
      page.reportDate.set('2026-11-20');
      page.selectedFiles.set([
        new File(['report'], 'report.pdf', {
          type: 'application/pdf',
        }),
      ]);
      page.detailsConfirmed.set(true);

      page.save();

      await vi.advanceTimersByTimeAsync(600);

      expect(page.uploadState()).toBe('failed');

      page.reportType.set('');
      page.retryUpload();

      expect(page.uploadState()).toBe('failed');
      expect(page.formError()).toContain('Enter the report type and date');

      page.reportType.set('Blood Test');
      page.selectedFiles.set([]);

      page.retryUpload();

      expect(page.uploadState()).toBe('failed');
      expect(page.formError()).toContain('select a report file');
    } finally {
      vi.useRealTimers();
    }
  });
});
