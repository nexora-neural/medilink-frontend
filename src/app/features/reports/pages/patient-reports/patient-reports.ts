import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { DocumentUpload } from '../../../../shared/components/document-upload/document-upload';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import type { LabReport, LabReportDraft, LabReportPageState } from '../../models/lab-report.model';
import { LabReportStore } from '../../services/lab-report.store';

type UploadState = 'idle' | 'uploading' | 'failed' | 'complete';

@Component({
  selector: 'app-patient-reports',
  standalone: true,
  imports: [DatePipe, DocumentUpload, UiState],
  providers: [LabReportStore],
  templateUrl: './patient-reports.html',
  styleUrl: './patient-reports.scss',
})
export class PatientReports {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(LabReportStore);
  private readonly destroyRef = inject(DestroyRef);

  private nextId = 1;
  private uploadSubscription?: Subscription;
  private pendingDraft: LabReportDraft | null = null;
  private uploadAttempt = 0;

  readonly reports = this.store.reports;
  readonly pageState = signal<LabReportPageState>('ready');
  readonly selectedReport = signal<LabReport | null>(null);

  readonly permitted = computed(
    () => this.roles.activeRole() === 'Patient' && this.roles.activeAccountId() !== null,
  );

  readonly visibleReports = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') {
      return [];
    }

    const accountId = this.roles.activeAccountId();

    return this.reports().filter((report) => report.patientId === accountId);
  });

  readonly selectedFiles = signal<File[]>([]);
  readonly reportType = signal('');
  readonly reportDate = signal('');
  readonly reference = signal('');
  readonly notes = signal('');
  readonly submitted = signal(false);
  readonly formOpen = signal(false);
  readonly formError = signal('');
  readonly message = signal('');

  readonly uploadState = signal<UploadState>('idle');
  readonly uploadProgress = signal(0);
  readonly detailsConfirmed = signal(false);

  readonly canUpload = computed(
    () =>
      this.permitted() &&
      ['ready', 'empty'].includes(this.pageState()) &&
      this.uploadState() !== 'uploading',
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
        this.resetAccountScopedState();
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.cancelUpload();

      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );

      this.formOpen.set(false);
      this.selectedReport.set(null);
      this.message.set('');
      this.formError.set('');
    });
  }

  viewReport(report: LabReport): void {
    if (!this.permitted() || this.pageState() !== 'ready') {
      return;
    }

    const accountId = this.roles.activeAccountId();

    if (!accountId || report.patientId !== accountId) {
      return;
    }

    this.selectedReport.set(report);
  }

  closeReportDetails(): void {
    this.selectedReport.set(null);
  }

  openForm(): void {
    if (!this.canUpload()) return;

    this.selectedReport.set(null);
    this.reportType.set('');
    this.reportDate.set('');
    this.reference.set('');
    this.notes.set('');
    this.selectedFiles.set([]);
    this.submitted.set(false);
    this.formError.set('');
    this.uploadState.set('idle');
    this.uploadProgress.set(0);
    this.detailsConfirmed.set(false);
    this.pendingDraft = null;
    this.uploadAttempt = 0;
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.cancelUpload();
    this.formOpen.set(false);
    this.submitted.set(false);
    this.formError.set('');
    this.pendingDraft = null;
  }

  onFilesChange(files: File[]): void {
    if (this.uploadState() === 'uploading') return;

    this.selectedFiles.set(files);
    this.formError.set('');
    this.uploadState.set('idle');
    this.uploadProgress.set(0);
    this.pendingDraft = null;
    this.uploadAttempt = 0;
  }

  save(): void {
    if (!this.canUpload() || !this.formOpen()) {
      return;
    }

    this.submitted.set(true);
    this.pendingDraft = null;

    const draft = this.createDraftFromCurrentForm();

    if (!draft) return;

    this.pendingDraft = draft;
    this.uploadAttempt = 0;
    this.startUpload();
  }

  retryUpload(): void {
    if (this.uploadState() !== 'failed' || !this.canUpload() || !this.formOpen()) {
      return;
    }

    // Always rebuild the draft from the current form values.
    this.submitted.set(true);
    this.pendingDraft = null;

    const draft = this.createDraftFromCurrentForm();

    if (!draft) return;

    this.pendingDraft = draft;
    this.startUpload();
  }

  cancelUpload(): void {
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = undefined;

    if (this.uploadState() === 'uploading') {
      this.uploadState.set('idle');
      this.uploadProgress.set(0);
    }
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
    this.store.load();
    this.message.set('');
  }

  private createDraftFromCurrentForm(): LabReportDraft | null {
    this.formError.set('');

    const type = this.reportType().trim();
    const date = this.reportDate();
    const reportReference = this.reference().trim();
    const reportNotes = this.notes().trim();
    const file = this.selectedFiles()[0];

    if (!type || !date || !file) {
      this.formError.set('Enter the report type and date, and select a report file.');
      return null;
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.getTime() > new Date().setHours(23, 59, 59, 999)
    ) {
      this.formError.set('Choose a valid report date that is not in the future.');
      return null;
    }

    const accountId = this.roles.activeAccountId();

    if (!accountId || this.roles.activeRole() !== 'Patient') {
      this.formError.set('Your patient account could not be verified.');
      return null;
    }

    if (!this.detailsConfirmed()) {
      this.formError.set(
        'Confirm your patient account and laboratory assignment before continuing.',
      );
      return null;
    }

    return {
      patientId: accountId,
      labId: '',
      reportType: type,
      reportDate: date,
      reference: reportReference,
      uploadRequestReference: null,
      notes: reportNotes,
      source: 'patient',
      file,
    };
  }

  private resetAccountScopedState(): void {
    this.cancelUpload();

    this.pendingDraft = null;
    this.uploadAttempt = 0;

    this.selectedReport.set(null);
    this.selectedFiles.set([]);
    this.reportType.set('');
    this.reportDate.set('');
    this.reference.set('');
    this.notes.set('');
    this.submitted.set(false);
    this.formOpen.set(false);
    this.formError.set('');
    this.message.set('');
    this.detailsConfirmed.set(false);
    this.uploadState.set('idle');
    this.uploadProgress.set(0);
  }

  private startUpload(): void {
    if (!this.pendingDraft || !this.canUpload() || !this.formOpen() || !this.detailsConfirmed()) {
      return;
    }

    this.uploadSubscription?.unsubscribe();
    this.uploadAttempt += 1;
    this.uploadState.set('uploading');
    this.uploadProgress.set(0);
    this.formError.set('');

    this.uploadSubscription = timer(0, 180)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const nextProgress = Math.min(this.uploadProgress() + 20, 100);
        this.uploadProgress.set(nextProgress);

        // First attempt intentionally fails to demonstrate recovery.
        if (this.uploadAttempt === 1 && nextProgress >= 60) {
          this.uploadSubscription?.unsubscribe();
          this.uploadSubscription = undefined;
          this.uploadState.set('failed');
          this.formError.set(
            'The sample upload failed. Your selected report is saved locally. Please retry.',
          );
          return;
        }

        if (nextProgress >= 100) {
          this.uploadSubscription?.unsubscribe();
          this.uploadSubscription = undefined;
          this.completeUpload();
        }
      });
  }

  private completeUpload(): void {
    const draft = this.pendingDraft;

    if (
      !draft ||
      !this.permitted() ||
      !this.detailsConfirmed() ||
      draft.patientId !== this.roles.activeAccountId()
    ) {
      this.resetAccountScopedState();
      return;
    }

    const report: LabReport = {
      id: `local-preview-${this.nextId++}`,
      reference: draft.reference || `LOCAL-${Date.now()}`,
      uploadRequestReference: draft.uploadRequestReference,
      patientId: draft.patientId,
      patientName: 'Current patient',
      labId: draft.labId,
      labName: 'Not assigned',
      reportType: draft.reportType,
      reportDate: draft.reportDate,
      notes: draft.notes,
      source: draft.source,
      fileName: draft.file.name,
      fileType: draft.file.type,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      reviewedAt: null,
    };

    this.store.addReport(report);

    this.uploadState.set('complete');
    this.message.set(
      'Sample report added locally. It is not linked to a laboratory request or uploaded to the server.',
    );

    this.pendingDraft = null;
    this.formOpen.set(false);
    this.submitted.set(false);
  }
}
