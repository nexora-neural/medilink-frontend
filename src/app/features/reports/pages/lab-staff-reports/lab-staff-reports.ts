import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  createApprovedSampleLabs,
  createSampleRequests,
  SAMPLE_STAFF_LAB_ID,
} from '../../../lab-upload-requests/data/lab-upload-request.samples';
import { getLabRequestStatus } from '../../../lab-upload-requests/models/lab-upload-request.model';
import type { LabReport, LabReportPageState, LabReportStatus } from '../../models/lab-report.model';
import { LabReportStore } from '../../services/lab-report.store';

@Component({
  selector: 'app-lab-staff-reports',
  standalone: true,
  imports: [DatePipe, UiState],
  providers: [LabReportStore],
  templateUrl: './lab-staff-reports.html',
  styleUrl: './lab-staff-reports.scss',
})
export class LabStaffReports {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(LabReportStore);

  private readonly requests = createSampleRequests();
  private readonly labs = createApprovedSampleLabs();

  readonly reports = this.store.reports;
  readonly pageState = signal<LabReportPageState>('ready');
  readonly currentTime = signal(Date.now());

  readonly selectedReportId = signal<string | null>(null);
  readonly patientAndLabConfirmed = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  readonly permitted = computed(() => this.roles.activeRole() === 'Lab Staff');

  readonly laboratoryName = computed(
    () => this.labs.find((lab) => lab.id === SAMPLE_STAFF_LAB_ID)?.name ?? 'Sample laboratory',
  );

  readonly visibleReports = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') {
      return [];
    }

    return this.reports().filter((report) => this.matchesActiveRequest(report));
  });

  readonly pendingReports = computed(() =>
    this.visibleReports().filter((report) => report.status === 'pending'),
  );

  readonly reviewedReports = computed(() =>
    this.visibleReports().filter((report) => report.status !== 'pending'),
  );

  readonly selectedReport = computed(
    () => this.visibleReports().find((report) => report.id === this.selectedReportId()) ?? null,
  );

  readonly canSubmitReview = computed(
    () =>
      this.permitted() &&
      this.pageState() === 'ready' &&
      this.selectedReport()?.status === 'pending' &&
      this.patientAndLabConfirmed(),
  );

  constructor() {
    this.store.load();

    let previousRole = this.roles.activeRole();
    let previousAccountId = this.roles.activeAccountId();

    effect(() => {
      const currentRole = this.roles.activeRole();
      const currentAccountId = this.roles.activeAccountId();

      if (currentRole !== previousRole || currentAccountId !== previousAccountId) {
        previousRole = currentRole;
        previousAccountId = currentAccountId;

        this.clearSelection();
        this.message.set('');
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );

      this.clearSelection();
    });

    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.currentTime.set(Date.now()));
  }

  private matchesActiveRequest(report: LabReport): boolean {
    const request = this.requests.find((item) => item.reference === report.uploadRequestReference);

    return (
      !!request &&
      request.labId === SAMPLE_STAFF_LAB_ID &&
      request.patientId === report.patientId &&
      report.labId === SAMPLE_STAFF_LAB_ID &&
      getLabRequestStatus(request, this.currentTime()) === 'active'
    );
  }

  selectReport(report: LabReport): void {
    if (!this.permitted() || report.status !== 'pending' || !this.matchesActiveRequest(report)) {
      return;
    }

    this.selectedReportId.set(report.id);
    this.patientAndLabConfirmed.set(false);
    this.message.set('');
    this.error.set('');
  }

  confirmPatientAndLab(confirmed: boolean): void {
    this.patientAndLabConfirmed.set(confirmed);
    this.error.set('');
  }

  reviewReport(status: Extract<LabReportStatus, 'accepted' | 'rejected'>): void {
    if (!this.canSubmitReview()) {
      this.error.set('Confirm the patient and assigned laboratory before reviewing this report.');
      return;
    }

    const report = this.selectedReport();

    if (!report || !this.matchesActiveRequest(report)) {
      this.error.set('This report no longer matches an active request for this laboratory.');
      this.clearSelection();
      return;
    }

    this.store.updateReportStatus(report.id, status);

    this.message.set(
      status === 'accepted'
        ? 'Sample report accepted. Actual patient notification is not connected in this preview.'
        : 'Sample report rejected. Actual patient notification is not connected in this preview.',
    );

    this.clearSelection();
  }

  clearSelection(): void {
    this.selectedReportId.set(null);
    this.patientAndLabConfirmed.set(false);
    this.error.set('');
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') {
      return;
    }

    this.pageState.set('ready');
    this.currentTime.set(Date.now());
    this.store.load();
    this.clearSelection();
    this.message.set('');
  }
}
