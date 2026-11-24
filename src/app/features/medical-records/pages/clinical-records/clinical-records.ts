import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  AllergyStatus,
  ClinicalEntryDraft,
  ClinicalEntryKind,
  CLINICAL_ENTRY_LABELS,
  CLINICAL_SOURCE_LABELS,
  CLINICAL_STATUS_LABELS,
  NO_KNOWN_ALLERGIES,
} from '../../models/clinical-record.model';
import {
  ClinicalRecordApiService,
  RecordConsultation,
  RecordPage,
  RecordPatient,
} from '../../services/clinical-record-api.service';

type Failure = 'denied' | 'expired' | 'error';
type DataState<T> = { kind: 'ready'; data: T } | { kind: Failure };
interface RecordData {
  history: RecordPage;
  allergy: AllergyStatus;
  consultation: RecordConsultation | null;
}

@Component({
  selector: 'app-clinical-records',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, UiState, RouterLink],
  templateUrl: './clinical-records.html',
  styleUrl: './clinical-records.scss',
})
export class ClinicalRecords {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roles = inject(ActiveRoleService);
  private readonly api = inject(ClinicalRecordApiService);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly audience: 'patient' | 'doctor' =
    this.route.snapshot.data['audience'] === 'doctor' ? 'doctor' : 'patient';
  readonly labels = CLINICAL_ENTRY_LABELS;
  readonly statusLabels = CLINICAL_STATUS_LABELS;
  readonly sourceLabels = CLINICAL_SOURCE_LABELS;
  readonly allowedKinds: ClinicalEntryKind[] =
    this.audience === 'patient' ? ['condition', 'allergy'] : ['diagnosis', 'note'];

  readonly account = computed(() => {
    const role = this.audience === 'patient' ? 'Patient' : 'Doctor';
    return this.roles.activeRole() === role && this.roles.roles().includes(role)
      ? this.roles.activeAccountId()
      : null;
  });
  readonly selection = computed(() => this.query().get('patient') ?? '');
  private readonly revision = signal(0);
  private readonly page = signal<{ patient: string; value: number } | null>(null);
  private readonly queueRequest = computed(() => ({
    account: this.account(),
    refresh: this.revision(),
  }));
  private readonly queueResult = signal<{
    request: { account: string | null; refresh: number };
    state: DataState<RecordPatient[]>;
  } | null>(null);
  readonly queue = computed(() => {
    const result = this.queueResult();
    return result?.request === this.queueRequest() ? result.state : null;
  });
  readonly patientOptions = computed(() => {
    const queue = this.queue();
    return queue?.kind === 'ready' ? queue.data : [];
  });
  private readonly chosenPatient = computed(() => {
    return this.patientOptions().find((patient) => patient.id === this.selection());
  });
  private readonly subject = computed(() => {
    const account = this.account();
    const patient = this.audience === 'patient' ? account : this.selection();
    return account && patient ? `${account}/${patient}` : null;
  });
  private readonly recordRequest = computed(() => {
    const account = this.account();
    const selection = this.chosenPatient();
    const patient = this.audience === 'patient' ? account : selection?.id;
    if (!account || !patient) return null;
    const page = this.page();
    return {
      account,
      patient,
      selection,
      page: page?.patient === patient ? page.value : 1,
      revision: this.revision(),
    };
  });
  private readonly recordResult = signal<{
    request: NonNullable<ReturnType<ClinicalRecords['recordRequest']>>;
    state: DataState<RecordData>;
  } | null>(null);

  readonly state = computed<DataState<RecordData> | { kind: 'loading' | 'select' }>(() => {
    if (!this.account()) return { kind: 'denied' };
    if (this.audience === 'doctor') {
      const queue = this.queue();
      if (!queue) return { kind: 'loading' };
      if (queue.kind !== 'ready') return queue;
      if (!this.selection()) return { kind: 'select' };
      if (!this.chosenPatient()) return { kind: 'denied' };
    }
    const result = this.recordResult();
    return result?.request === this.recordRequest() ? result.state : { kind: 'loading' };
  });
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal('');
  private readonly notice = signal<{ subject: string; text: string; error?: boolean } | null>(null);
  readonly message = computed(() => {
    const notice = this.notice();
    return notice?.subject === this.subject() ? notice : null;
  });
  private readonly writing = signal(false);
  readonly saving = this.writing.asReadonly();
  readonly canAdd = computed(() => {
    const state = this.state();
    return state.kind === 'ready' && (this.audience === 'patient' || !!state.data.consultation);
  });
  readonly form = new FormGroup({
    kind: new FormControl<ClinicalEntryKind>(this.allowedKinds[0], { nonNullable: true }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    details: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(8000)] }),
    recordedAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      this.subject();
      this.closeForm();
      this.notice.set(null);
    });

    effect((cleanup) => {
      const request = this.queueRequest();
      if (this.audience !== 'doctor' || !request.account) return;

      let current = true;
      cleanup(() => {
        current = false;
      });
      void this.api.patients().then(
        (data) => {
          if (current) this.queueResult.set({ request, state: { kind: 'ready', data } });
        },
        (error: unknown) => {
          if (current) this.queueResult.set({ request, state: { kind: this.failure(error) } });
        },
      );
    });

    effect((cleanup) => {
      const request = this.recordRequest();
      if (!request) return;

      let current = true;
      cleanup(() => {
        current = false;
      });
      void Promise.all([
        this.api.list(request.patient, request.page),
        this.api.allergyStatus(request.patient),
        request.selection ? this.api.consultation(request.selection, request.account) : null,
      ]).then(
        ([history, allergy, consultation]) => {
          if (current)
            this.recordResult.set({
              request,
              state: { kind: 'ready', data: { history, allergy, consultation } },
            });
        },
        (error: unknown) => {
          if (current) this.recordResult.set({ request, state: { kind: this.failure(error) } });
        },
      );
    });
  }

  selectPatient(patient: string): void {
    if (this.saving()) return;
    this.page.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { patient: patient || null },
    });
  }

  refresh(): void {
    if (!this.saving()) {
      this.closeForm();
      this.notice.set(null);
      this.reload();
    }
  }

  changePage(value: number): void {
    const request = this.recordRequest();
    const state = this.state();
    if (!request || state.kind !== 'ready' || this.saving() || this.formOpen()) return;
    if (value < 1 || value > Math.ceil(state.data.history.total / state.data.history.pageSize))
      return;
    this.page.set({ patient: request.patient, value });
  }

  openForm(): void {
    if (!this.canAdd() || this.saving()) return;
    this.form.reset({
      kind: this.allowedKinds[0],
      title: '',
      details: '',
      recordedAt: this.localDateTime(),
    });
    this.submitted.set(false);
    this.formError.set('');
    this.notice.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.submitted.set(false);
    this.formError.set('');
    this.form.reset();
  }

  save(): void {
    if (!this.canAdd() || !this.formOpen() || this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.formError.set('');

    const draft = this.form.getRawValue();
    const title = draft.title.trim();
    const details = draft.details.trim();
    const recordedAt = new Date(draft.recordedAt);
    if (this.form.invalid || !title || !this.allowedKinds.includes(draft.kind)) {
      this.formError.set('Enter a title, a valid date and values within the field limits.');
      return;
    }
    if (!Number.isFinite(recordedAt.getTime()) || recordedAt.getTime() > Date.now()) {
      this.formError.set('Choose a recorded time that is not in the future.');
      return;
    }
    if (title.includes('\0') || details.includes('\0')) {
      this.formError.set('Remove invalid characters before saving.');
      return;
    }
    if (draft.kind === 'allergy' && title.toLowerCase() === NO_KNOWN_ALLERGIES.toLowerCase()) {
      this.formError.set('Use Report no known allergies to record that statement.');
      return;
    }

    void this.persist({ kind: draft.kind, title, details, recordedAt: recordedAt.toISOString() });
  }

  reportNoKnownAllergies(): void {
    const state = this.state();
    if (
      this.audience !== 'patient' ||
      state.kind !== 'ready' ||
      state.data.allergy !== 'unknown' ||
      this.saving() ||
      this.formOpen()
    )
      return;

    void this.persist({
      kind: 'allergy',
      title: NO_KNOWN_ALLERGIES,
      details: '',
      recordedAt: new Date().toISOString(),
    });
  }

  private async persist(entry: ClinicalEntryDraft): Promise<void> {
    const request = this.recordRequest();
    const subject = this.subject();
    const state = this.state();
    if (!request || !subject || state.kind !== 'ready' || this.saving()) return;
    const consultation = state.data.consultation;
    if (
      this.audience === 'doctor' &&
      (!consultation || Date.parse(consultation.expiresAt) <= Date.now())
    ) {
      this.closeForm();
      this.notice.set({
        subject,
        text: 'Consultation access expired. Refresh the record to check access.',
        error: true,
      });
      this.reload();
      return;
    }

    this.writing.set(true);
    this.notice.set(null);
    try {
      await this.api.add(request.patient, entry, consultation?.id);
      if (request !== this.recordRequest()) return;
      this.closeForm();
      this.notice.set({ subject, text: 'Entry saved.' });
      this.reload();
    } catch (error: unknown) {
      if (request !== this.recordRequest()) return;
      const failure = this.failure(error);
      if (failure === 'expired' || failure === 'denied') {
        this.closeForm();
        this.notice.set({
          subject,
          text: 'The entry could not be saved because access changed.',
          error: true,
        });
        if (failure === 'expired') this.recordResult.set({ request, state: { kind: failure } });
        else this.reload();
      } else if (error instanceof HttpErrorResponse && error.status === 422 && this.formOpen()) {
        this.formError.set('Check the entry details before trying again.');
      } else {
        this.closeForm();
        this.notice.set({
          subject,
          text: 'The save could not be confirmed. Review the refreshed history before trying again.',
          error: true,
        });
        this.reload();
      }
    } finally {
      this.writing.set(false);
    }
  }

  private reload(): void {
    this.page.set(null);
    this.revision.update((revision) => revision + 1);
  }

  private failure(error: unknown): Failure {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'expired';
      if (error.status === 403 || error.status === 404) return 'denied';
    }
    if (
      error instanceof Error &&
      (error.message === 'Please sign in to continue.' ||
        ('code' in error &&
          ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled'].includes(
            String(error.code),
          )))
    )
      return 'expired';
    return 'error';
  }

  private localDateTime(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
}
