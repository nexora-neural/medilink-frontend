import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { LabReport, ReportDraft, ReportPermissions } from '../models/report-correction.models';

@Injectable({ providedIn: 'root' })
export class ReportCorrectionStore implements OnDestroy {
  private readonly router = inject(Router);
  private readonly roleContext = inject(ActiveRoleService);

  // Reports are supplied by the upload/integration flow.
  reports: LabReport[] = [];
  laboratory = 'Central Laboratory';
  selectedId = '';
  base = '/workspace/lab-staff/reports';

  message = '';
  messageKind: 'success' | 'error' = 'success';
  correctionReason = '';

  correctionDraft: ReportDraft = {
    type: '',
    date: '',
    reference: '',
    notes: '',
    file: '',
    url: '',
    mime: '',
  };

  showConfirm = false;
  pending = false;
  loading = false;
  loadError = '';
  dirty = false;

  private permissions: Readonly<Record<string, ReportPermissions>> = {};
  private timer?: ReturnType<typeof setTimeout>;
  private readonly ownedUrls = new Set<string>();
  private saved = false;
  private sequence = 0;

  private readonly accountChangesSubscription = this.roleContext.workspaceChanges$.subscribe(() => {
    this.clearAccountState();
  });

  private get hasActionRole(): boolean {
    const role = this.roleContext.activeRole();

    if (!this.roleContext.activeAccountId() || !this.roleContext.roles().includes(role)) {
      return false;
    }

    return (
      (role === 'Patient' && this.base === '/workspace/patient/reports') ||
      (role === 'Lab Staff' && this.base === '/workspace/lab-staff/reports')
    );
  }

  get selected(): LabReport | undefined {
    return this.reports.find((report) => report.id === this.selectedId);
  }

  get canCorrect(): boolean {
    return (
      this.hasActionRole &&
      this.selected?.status === 'Published' &&
      this.permissions[this.selectedId]?.correct === true
    );
  }

  get canWithdraw(): boolean {
    return (
      this.hasActionRole &&
      this.selected?.status === 'Published' &&
      this.permissions[this.selectedId]?.withdraw === true
    );
  }

  /**
   * ML-143 must supply only reports authorized for the signed-in account.
   * Patient views must receive only reports the patient may access.
   * Action capabilities must come from trusted source, ownership,
   * verified-staff and original-laboratory checks.
   * Patient display names must never be used as ownership identifiers.
   * The API must authorize every read, correction and withdrawal.
   */
  setReports(
    reports: readonly LabReport[],
    permissions: Readonly<Record<string, ReportPermissions>>,
  ): void {
    this.reports = reports.map((report) => ({ ...report }));
    this.permissions = { ...permissions };
    this.loading = false;
    this.loadError = '';
  }

  setMessage(message: string, kind: 'success' | 'error' = 'success'): void {
    this.message = message;
    this.messageKind = kind;
  }

  select(id: string): void {
    this.selectedId = id;
  }

  resetDraft(): void {
    const report = this.selected;

    this.releaseDraft();

    this.correctionDraft = {
      type: report?.type ?? '',
      date: report?.date ?? '',
      reference: report?.reference ?? '',
      notes: report?.notes ?? '',
      file: '',
      url: '',
      mime: '',
    };

    this.correctionReason = '';
    this.showConfirm = false;
    this.dirty = false;
    this.saved = false;
  }

  markDirty(): void {
    this.dirty = true;
    this.showConfirm = false;
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.releaseDraft();

    if (
      (file.type !== 'application/pdf' && !file.type.startsWith('image/')) ||
      file.size > 10 * 1024 * 1024
    ) {
      this.correctionDraft.file = '';
      this.correctionDraft.url = '';
      this.correctionDraft.mime = '';

      this.setMessage(
        file.size > 10 * 1024 * 1024
          ? 'File is too large. Choose a file up to 10 MB.'
          : 'Choose a PDF or image file.',
        'error',
      );

      input.value = '';
      return;
    }

    const url = URL.createObjectURL(file);

    this.ownedUrls.add(url);
    this.correctionDraft.file = file.name;
    this.correctionDraft.url = url;
    this.correctionDraft.mime = file.type;

    this.markDirty();
    this.setMessage('');
  }

  ready(): boolean {
    const draft = this.correctionDraft;

    return !!(
      draft.type.trim() &&
      draft.date &&
      draft.reference.trim() &&
      draft.file &&
      draft.url &&
      this.correctionReason.trim()
    );
  }

  reviewCorrection(): void {
    if (!this.canCorrect || !this.ready()) {
      this.setMessage('Provide a reason, report details and replacement file.', 'error');
      return;
    }

    this.setMessage('');
    this.showConfirm = true;
  }

  reviewWithdrawal(): void {
    if (!this.canWithdraw || !this.correctionReason.trim()) {
      this.setMessage('Enter a reason before withdrawing this report.', 'error');
      return;
    }

    this.setMessage('');
    this.showConfirm = true;
  }

  correct(): void {
    if (!this.canCorrect || !this.ready() || !this.showConfirm || this.pending) return;

    this.run(() => {
      if (!this.canCorrect || !this.ready()) {
        this.setMessage('Provide a reason, report details and replacement file.', 'error');
        return;
      }

      const old = this.selected!;

      const next: LabReport = {
        ...this.correctionDraft,
        id: 'LR-' + Date.now() + '-' + ++this.sequence,
        patient: old.patient,
        request: old.request,
        status: 'Published',
        version: old.version + 1,
        reason: this.correctionReason.trim(),
        previous: old.id,
      };

      this.reports = [
        next,
        ...this.reports.map((report) =>
          report.id === old.id ? { ...report, status: 'Superseded' as const } : report,
        ),
      ];

      this.permissions = {
        ...this.permissions,
        [next.id]: { ...this.permissions[old.id] },
      };

      // The saved replacement retains its URL until account cleanup or destruction.
      this.correctionDraft = {
        ...this.correctionDraft,
        url: '',
      };

      this.saved = true;
      this.dirty = false;
      this.showConfirm = false;

      this.setMessage('Corrected version published; the original remains in history.');

      void this.router.navigate([this.base, next.id]);
    });
  }

  withdraw(): void {
    if (!this.canWithdraw || !this.correctionReason.trim() || !this.showConfirm || this.pending) {
      return;
    }

    this.run(() => {
      if (!this.canWithdraw || !this.correctionReason.trim()) {
        this.setMessage('Enter a reason before withdrawing this report.', 'error');
        return;
      }

      const id = this.selectedId;

      this.reports = this.reports.map((report) =>
        report.id === id
          ? {
              ...report,
              status: 'Withdrawn',
              reason: this.correctionReason.trim(),
            }
          : report,
      );

      this.saved = true;
      this.dirty = false;
      this.showConfirm = false;

      this.setMessage('Report withdrawn; the record remains in history.');

      void this.router.navigate([this.base, id]);
    });
  }

  canLeave(): boolean {
    if (this.pending) return false;

    return (
      this.saved || !this.dirty || window.confirm('Leave this page? Unsaved changes will be lost.')
    );
  }

  private run(action: () => void): void {
    this.pending = true;
    this.setMessage('');

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pending = false;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setMessage(
          'The action could not be completed. Check your connection and try again.',
          'error',
        );
        return;
      }

      action();
    }, 400);
  }

  private releaseDraft(): void {
    const url = this.correctionDraft.url;

    if (url && this.ownedUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.ownedUrls.delete(url);
    }
  }

  private clearAccountState(): void {
    clearTimeout(this.timer);
    this.timer = undefined;

    this.ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    this.ownedUrls.clear();

    this.reports = [];
    this.permissions = {};
    this.selectedId = '';
    this.laboratory = 'Central Laboratory';

    this.correctionDraft = {
      type: '',
      date: '',
      reference: '',
      notes: '',
      file: '',
      url: '',
      mime: '',
    };

    this.correctionReason = '';
    this.message = '';
    this.messageKind = 'success';
    this.showConfirm = false;
    this.pending = false;
    this.loading = false;
    this.loadError = '';
    this.saved = false;
    this.dirty = false;
    this.sequence = 0;
  }

  ngOnDestroy(): void {
    this.accountChangesSubscription.unsubscribe();
    this.clearAccountState();
  }
}
