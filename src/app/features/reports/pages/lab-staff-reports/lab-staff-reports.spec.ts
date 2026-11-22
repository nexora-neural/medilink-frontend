import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import { SAMPLE_ACTIVE_REFERENCE } from '../../../lab-upload-requests/data/lab-upload-request.samples';
import { LabStaffReports } from './lab-staff-reports';

describe('LabStaffReports preview', () => {
  async function setup(preview = '') {
    const activeRole = signal<ActiveRole>('Lab Staff');

    await TestBed.configureTestingModule({
      imports: [LabStaffReports],
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
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LabStaffReports);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      activeRole,
    };
  }

  it('shows only reports matching an active request for the sample laboratory', async () => {
    const { page, fixture } = await setup();

    expect(page.visibleReports()).toHaveLength(2);
    expect(page.pendingReports()).toHaveLength(1);
    expect(page.pendingReports()[0].uploadRequestReference).toBe(SAMPLE_ACTIVE_REFERENCE);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Example Central Laboratory');
    expect(element.textContent).toContain('MLR-2026-001');
    expect(element.textContent).not.toContain('sample_8e4a2c7f1b9d6035');
  });

  it('requires patient and laboratory confirmation before review', async () => {
    const { page } = await setup();

    const report = page.pendingReports()[0];
    page.selectReport(report);

    expect(page.selectedReport()?.id).toBe(report.id);
    expect(page.canSubmitReview()).toBe(false);

    page.reviewReport('accepted');

    expect(page.error()).toContain('Confirm the patient and assigned laboratory');
    expect(page.selectedReport()?.id).toBe(report.id);
    expect(page.pendingReports()).toHaveLength(1);
  });

  it('accepts a report after patient and laboratory confirmation', async () => {
    const { page, fixture } = await setup();

    const report = page.pendingReports()[0];
    page.selectReport(report);
    page.confirmPatientAndLab(true);

    expect(page.canSubmitReview()).toBe(true);

    page.reviewReport('accepted');
    fixture.detectChanges();

    expect(page.pendingReports()).toHaveLength(0);
    expect(page.reviewedReports()).toHaveLength(2);
    expect(page.reviewedReports().find((item) => item.id === report.id)?.status).toBe('accepted');
    expect(page.message()).toContain('Sample report accepted');
    expect(page.selectedReport()).toBeNull();
  });

  it('rejects a report after patient and laboratory confirmation', async () => {
    const { page } = await setup();

    const report = page.pendingReports()[0];
    page.selectReport(report);
    page.confirmPatientAndLab(true);
    page.reviewReport('rejected');

    expect(page.pendingReports()).toHaveLength(0);
    expect(page.reviewedReports().find((item) => item.id === report.id)?.status).toBe('rejected');
    expect(page.message()).toContain('Sample report rejected');
  });

  it('does not select a report that is not pending', async () => {
    const { page } = await setup();

    const acceptedReport = page.visibleReports().find((report) => report.status === 'accepted');

    expect(acceptedReport).toBeDefined();

    page.selectReport(acceptedReport!);

    expect(page.selectedReport()).toBeNull();
    expect(page.canSubmitReview()).toBe(false);
  });

  it('hides reports when their upload request expires', async () => {
    const { page, fixture } = await setup();

    page.currentTime.set(Date.now() + 7 * 24 * 60 * 60 * 1000);
    fixture.detectChanges();

    expect(page.visibleReports()).toHaveLength(0);
    expect(page.pendingReports()).toHaveLength(0);
  });

  it('hides reports when the active role changes', async () => {
    const { page, fixture, activeRole } = await setup();

    expect(page.visibleReports()).toHaveLength(2);

    page.selectReport(page.pendingReports()[0]);
    expect(page.selectedReport()).not.toBeNull();

    activeRole.set('Patient');
    fixture.detectChanges();

    expect(page.permitted()).toBe(false);
    expect(page.visibleReports()).toHaveLength(0);
    expect(page.selectedReport()).toBeNull();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Access unavailable');
    expect(element.textContent).not.toContain('Kasun Perera');
  });

  for (const preview of ['loading', 'empty', 'error', 'denied']) {
    it(`blocks report review in the ${preview} preview`, async () => {
      const { page, fixture } = await setup(preview);

      expect(page.visibleReports()).toHaveLength(0);
      expect(page.canSubmitReview()).toBe(false);

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('Kasun Perera');
      expect(element.querySelector('.review-panel')).toBeNull();
    });
  }

  it('restores the report workspace after retrying an error preview', async () => {
    const { page, fixture } = await setup('error');

    page.retry();
    fixture.detectChanges();

    expect(page.pageState()).toBe('ready');
    expect(page.visibleReports()).toHaveLength(2);
  });

  it('clears the selected report when cancelling review', async () => {
    const { page } = await setup();

    page.selectReport(page.pendingReports()[0]);
    page.confirmPatientAndLab(true);
    page.clearSelection();

    expect(page.selectedReport()).toBeNull();
    expect(page.patientAndLabConfirmed()).toBe(false);
    expect(page.canSubmitReview()).toBe(false);
  });
});
