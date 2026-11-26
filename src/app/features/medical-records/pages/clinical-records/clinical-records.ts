import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DoctorPatientQueueApi } from '../../../doctors/pages/doctor-patient-queue/doctor-patient-queue-api.service';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  createSampleEntries,
  SAMPLE_DOCTOR_ID,
  SAMPLE_PATIENT_ID,
} from '../../data/clinical-record.samples';
import {
  AllergyStatus,
  ClinicalEntry,
  ClinicalEntryKind,
  CLINICAL_ENTRY_LABELS,
  CLINICAL_STATUS_LABELS,
  RecordPageState,
} from '../../models/clinical-record.model';

@Component({
  selector: 'app-clinical-records',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, UiState, RouterLink],
  templateUrl: './clinical-records.html',
  styleUrl: './clinical-records.scss',
})
export class ClinicalRecords {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly queueApi = inject(DoctorPatientQueueApi);
  readonly livePatientRecords = this.route.snapshot.data['livePatientRecords'] === true;
  readonly loadingLive = signal(false);
  readonly liveError = signal('');
  readonly accessDenied = signal(false);
  private nextId = 1;

  readonly audience: 'patient' | 'doctor' =
    this.route.snapshot.data['audience'] === 'doctor' ? 'doctor' : 'patient';

  readonly labels = CLINICAL_ENTRY_LABELS;
  readonly statusLabels = CLINICAL_STATUS_LABELS;
  readonly entries = signal<ClinicalEntry[]>(createSampleEntries());
  readonly pageState = signal<RecordPageState>('ready');
  readonly allergyStatus = signal<AllergyStatus>('allergies-recorded');
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly message = signal('');
  readonly formError = signal('');

  readonly allowedKinds: ClinicalEntryKind[] =
    this.audience === 'patient' ? ['condition', 'allergy'] : ['diagnosis', 'note'];

  readonly permitted = computed(() =>
    this.audience === 'patient'
      ? this.roles.activeRole() === 'Patient'
      : this.roles.activeRole() === 'Doctor',
  );

  readonly canAdd = computed(
    () =>
      this.permitted() && !this.livePatientRecords && ['ready', 'empty'].includes(this.pageState()),
  );

  readonly visibleEntries = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') {
      return [];
    }

    return [...this.entries()].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  });

  readonly form = new FormGroup({
    kind: new FormControl<ClinicalEntryKind>(this.allowedKinds[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    details: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    recordedAt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    if (this.livePatientRecords) {
      this.pageState.set('loading');
      this.loadingLive.set(true);
      void this.loadLiveRecords();
    }
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );
      if (this.pageState() === 'empty') {
        this.allergyStatus.set('unknown');
      }

      this.closeForm();
      this.message.set('');
    });
  }

  async loadLiveRecords(): Promise<void> {
    const patientId = this.route.snapshot.paramMap.get('id');
    if (!patientId) {
      this.liveError.set('Patient reference is missing.');
      this.pageState.set('error');
      this.loadingLive.set(false);
      return;
    }
    this.loadingLive.set(true);
    this.liveError.set('');
    try {
      const page = await this.queueApi.listRecords(patientId);
      this.entries.set(
        page.items.map((item) => ({
          id: item.id,
          kind: item.type as ClinicalEntryKind,
          title: item.title,
          details: item.description ?? '',
          recordedAt: item.recorded_at,
          source: item.source === 'professional' ? 'doctor' : 'patient',
          authorId: '',
          authorName: item.source === 'professional' ? 'Verified care professional' : 'Patient',
          organization: null,
          status:
            item.status === 'entered_in_error'
              ? 'entered-in-error'
              : item.status === 'resolved'
                ? 'resolved'
                : 'active',
        })),
      );
      this.pageState.set(page.items.length ? 'ready' : 'empty');
      this.allergyStatus.set(
        page.items.some((item) => item.type === 'allergy') ? 'allergies-recorded' : 'unknown',
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      const denied = status === 403 || status === 404;
      this.liveError.set(
        denied
          ? 'The patient has not granted access to these records.'
          : status === 401
            ? 'Sign in again to view patient records.'
            : 'Patient records are unavailable. Check the connection and retry.',
      );
      this.accessDenied.set(denied);
      this.pageState.set(denied ? 'denied' : 'error');
    } finally {
      this.loadingLive.set(false);
    }
  }

  openForm(): void {
    if (!this.canAdd() || this.livePatientRecords) return;

    this.form.reset({
      kind: this.allowedKinds[0],
      title: '',
      details: '',
      recordedAt: this.localDateTime(),
    });
    this.submitted.set(false);
    this.formError.set('');
    this.message.set('');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.submitted.set(false);
    this.formError.set('');
  }

  save(): void {
    if (!this.canAdd() || !this.formOpen() || this.livePatientRecords) return;

    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.formError.set('');

    const draft = this.form.getRawValue();
    const title = draft.title.trim();
    const details = draft.details.trim();
    const recordedAt = new Date(draft.recordedAt);

    if (this.form.invalid || !title) {
      this.formError.set('Enter a title, a valid date and values within the field limits.');
      return;
    }

    if (!this.allowedKinds.includes(draft.kind)) {
      this.formError.set('This entry type is not available in this workspace.');
      return;
    }

    if (!Number.isFinite(recordedAt.getTime()) || recordedAt.getTime() > Date.now()) {
      this.formError.set('Choose a valid recorded time that is not in the future.');
      return;
    }

    if (title.includes('\0') || details.includes('\0')) {
      this.formError.set('Remove invalid characters before saving.');
      return;
    }

    const isPatient = this.audience === 'patient';

    const entry: ClinicalEntry = {
      id: `local-preview-${this.nextId++}`,
      kind: draft.kind,
      title,
      details,
      recordedAt: recordedAt.toISOString(),
      source: isPatient ? 'patient' : 'doctor',
      authorId: isPatient ? SAMPLE_PATIENT_ID : SAMPLE_DOCTOR_ID,
      authorName: isPatient ? 'Sample Patient' : 'Dr. Sample Silva',
      organization: isPatient ? null : 'Example Care Clinic',
      status: 'active',
    };

    // Starting from an empty preview must not reveal the seeded records.
    this.entries.update((items) => (this.pageState() === 'empty' ? [entry] : [entry, ...items]));

    if (entry.kind === 'allergy') {
      this.allergyStatus.set('allergies-recorded');
    }

    this.pageState.set('ready');
    this.closeForm();
    this.message.set('Sample entry added. It will be lost when you leave or refresh.');
  }

  setAllergyStatus(status: 'unknown' | 'no-known-allergies'): void {
    if (!this.canAdd() || this.audience !== 'patient') return;

    const hasActiveAllergy =
      this.pageState() === 'ready' &&
      this.entries().some((entry) => entry.kind === 'allergy' && entry.status === 'active');

    if (hasActiveAllergy) {
      this.message.set(
        'An active sample allergy is recorded. Its status cannot be replaced by this control.',
      );
      return;
    }

    this.allergyStatus.set(status);
    this.message.set('Sample allergy status updated temporarily.');
  }

  retry(): void {
    if (this.livePatientRecords) {
      void this.loadLiveRecords();
      return;
    }
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
    this.message.set('');
  }

  private localDateTime(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
}
