import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { ActiveOrganizationService } from '../../../core/context/active-organization.service';
import {
  LabUploadRequestApi,
  ResolvedUploadRequest,
} from '../../lab-upload-requests/services/lab-upload-request-api.service';
import { ReportApi, ReportAttempt, SavedReport } from '../services/report-api.service';

@Component({
  selector: 'app-reports-live',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './reports-live.html',
  styleUrl: './reports-live.scss',
})
export class ReportsLive {
  private readonly api = inject(ReportApi);
  private readonly requests = inject(LabUploadRequestApi);
  private readonly roles = inject(ActiveRoleService);
  private readonly organizations = inject(ActiveOrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private version = 0;
  private listVersion = 0;
  private alive = true;
  private attempt: ReportAttempt | null = null;

  readonly lab = this.route.snapshot.data['reportAudience'] === 'lab';

  readonly permitted = computed(
    () =>
      !!this.roles.activeAccountId() &&
      this.roles.activeRole() === (this.lab ? 'Lab Staff' : 'Patient'),
  );

  readonly reports = signal<SavedReport[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly locked = signal(false);
  readonly denied = signal(false);
  readonly listError = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly resolved = signal<ResolvedUploadRequest | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);

  readonly today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  reportType = '';
  reportDate = '';
  notes = '';
  labReference = '';
  token = '';
  confirmed = false;
  file: File | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
      this.version++;
    });

    effect(() => {
      this.roles.activeAccountId();
      this.roles.activeRole();
      this.organizations.activeOrganizationId();

      untracked(() => {
        this.version++;
        this.attempt = null;
        this.locked.set(false);
        this.busy.set(false);
        this.resolved.set(null);
        this.reports.set([]);
        this.clearForm();
        this.token = '';
        this.error.set('');
        this.message.set('');
        this.denied.set(!this.permitted());
        void this.load(1);
      });
    });
  }

  private scope(): string {
    return `${this.roles.activeAccountId()}/${this.roles.activeRole()}/${this.organizations.activeOrganizationId()}`;
  }

  private guard(): () => boolean {
    const version = this.version;
    const scope = this.scope();

    return () =>
      this.alive && version === this.version && scope === this.scope() && this.permitted();
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401 || error.status === 403) {
        this.denied.set(true);
        this.reports.set([]);
        return 'Access denied. Check your sign-in and approved laboratory membership.';
      }

      if (error.status === 409)
        return 'The request or report conflicts with saved data. Retry the same upload to confirm its outcome.';

      if (error.status === 422) return 'Check the report details, request and file.';
      if (error.status === 413) return 'The file exceeds the upload size limit.';
      if (error.status === 415) return 'Choose a PDF, JPEG or PNG report.';
      if (error.status === 429) return 'Too many attempts. Wait before retrying.';
      if (error.status === 404) return 'The request or document is unavailable.';
    }

    return 'The service is unavailable. Your form is retained; please retry.';
  }

  async load(page = this.page()): Promise<void> {
    if (!this.permitted()) return;

    const accountCurrent = this.guard();
    const listVersion = ++this.listVersion;
    const current = () => accountCurrent() && listVersion === this.listVersion;

    this.loading.set(true);
    this.listError.set('');
    this.reports.set([]);

    try {
      const result = await this.api.list(this.lab ? null : this.roles.activeAccountId(), page);

      if (!current()) return;

      this.reports.set(result.items);
      this.page.set(result.page);
      this.total.set(result.total);
      this.denied.set(false);
    } catch (error) {
      if (current()) this.listError.set(this.describe(error));
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  changeToken(value: string): void {
    this.token = value;
    this.resolved.set(null);
    this.confirmed = false;
  }

  async resolve(): Promise<void> {
    const laboratory = this.organizations.activeOrganizationId();

    if (!this.permitted() || this.busy() || this.locked()) return;

    if (!laboratory || !this.token.trim()) {
      this.error.set('Select your laboratory and enter the patient upload request token.');
      return;
    }

    const current = this.guard();

    this.busy.set(true);
    this.resolved.set(null);
    this.confirmed = false;
    this.error.set('');

    try {
      const request = await this.requests.resolveRequest(laboratory, this.token.trim());

      if (!current()) return;

      if (request.laboratory_id !== laboratory || !(Date.parse(request.expires_at) > Date.now())) {
        this.error.set('The matching upload request has expired or is unavailable.');
        return;
      }

      this.resolved.set(request);
    } catch (error) {
      if (current()) this.error.set(this.describe(error));
    } finally {
      if (current()) this.busy.set(false);
    }
  }

  selectFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  async save(): Promise<void> {
    if (!this.permitted() || this.busy()) return;

    this.error.set('');
    this.message.set('');

    if (!this.attempt || !this.locked()) {
      const previousAttempt = this.attempt;
      const request = this.resolved();
      const date = new Date(`${this.reportDate}T00:00:00`);

      if (
        !this.file ||
        !this.reportType.trim() ||
        this.reportType.trim().length > 200 ||
        !Number.isFinite(date.getTime()) ||
        this.reportDate > this.today ||
        this.notes.trim().length > 2000
      ) {
        this.error.set(
          'Enter a report type, valid date, notes up to 2000 characters and one report file.',
        );
        return;
      }

      if (
        this.lab &&
        (!request ||
          !this.confirmed ||
          request.laboratory_id !== this.organizations.activeOrganizationId() ||
          !(Date.parse(request.expires_at) > Date.now()) ||
          !this.labReference.trim() ||
          this.labReference.trim().length > 150)
      ) {
        this.error.set(
          'Resolve a valid matching request, confirm the patient and enter the laboratory reference.',
        );
        return;
      }

      this.attempt = {
        key: crypto.randomUUID(),
        documentId:
          previousAttempt?.input.file === this.file &&
          previousAttempt.input.patientId ===
            (this.lab ? request!.patient.patient_user_id : this.roles.activeAccountId()) &&
          previousAttempt.input.requestId === (this.lab ? request!.request_id : undefined)
            ? previousAttempt.documentId
            : undefined,
        input: {
          patientId: this.lab ? request!.patient.patient_user_id : this.roles.activeAccountId()!,
          file: this.file,
          reportType: this.reportType.trim(),
          reportDate: this.reportDate,
          notes: this.notes.trim(),
          ...(this.lab
            ? {
                requestId: request!.request_id,
                labReference: this.labReference.trim(),
              }
            : {}),
        },
      };
    }

    const current = this.guard();
    const attempt = this.attempt;

    this.busy.set(true);
    this.locked.set(true);

    try {
      await this.api.upload(attempt, current);

      if (!current()) return;

      this.attempt = null;
      this.locked.set(false);
      this.resolved.set(null);
      this.token = '';
      this.clearForm();
      this.message.set('Report saved.');

      await this.load(1);
    } catch (error) {
      if (!current()) return;

      this.error.set(this.describe(error));

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.code === 'INVALID_STATE' &&
        error.error?.message === 'Upload request is no longer active.'
      ) {
        this.attempt = null;
        this.locked.set(false);
        this.resolved.set(null);
        this.confirmed = false;
        this.token = '';

        this.error.set(
          'This upload request is no longer active. Enter a new request token and confirm the patient and laboratory again. Your report details and file are retained.',
        );
        return;
      }

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.code === 'INVALID_STATE' &&
        error.error?.message === 'Report reference already exists.'
      ) {
        this.locked.set(false);

        this.error.set(
          'This laboratory reference already exists. Enter a different reference and submit again.',
        );
        return;
      }

      if (error instanceof HttpErrorResponse && error.status === 422) {
        this.locked.set(false);
        return;
      }

      if (
        error instanceof HttpErrorResponse &&
        ((error.status === 404 &&
          error.error?.code === 'NOT_FOUND' &&
          error.error?.message === 'Report document not found.') ||
          (error.status === 409 &&
            error.error?.code === 'INVALID_STATE' &&
            error.error?.message === 'Report document content is unavailable.'))
      ) {
        this.attempt = null;
        this.locked.set(false);

        this.error.set(
          'The uploaded document is unavailable. Submit again to upload your selected file.',
        );
        return;
      }

      // Preserve uncertain publication attempts for safe same-key retries.
      if (!attempt.documentId) {
        this.attempt = null;
        this.locked.set(false);
      }
    } finally {
      if (current()) this.busy.set(false);
    }
  }

  private clearForm(): void {
    this.reportType = '';
    this.reportDate = '';
    this.notes = '';
    this.labReference = '';
    this.file = null;
    this.confirmed = false;

    const fileInput = this.host.nativeElement.querySelector<HTMLInputElement>('input[type="file"]');

    if (fileInput) fileInput.value = '';
  }

  async download(report: SavedReport): Promise<void> {
    if (!this.permitted() || this.busy()) return;

    const current = this.guard();

    this.busy.set(true);
    this.error.set('');

    try {
      const blob = await this.api.download(report.document_id);

      if (!current()) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `report-${report.id}`;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (current()) this.error.set(this.describe(error));
    } finally {
      if (current()) this.busy.set(false);
    }
  }
}
