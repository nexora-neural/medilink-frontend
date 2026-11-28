import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/auth.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import {
  PrescriptionDetailResponse,
  PrescriptionInput,
  PrescriptionItemInput,
} from '../../models/prescription-api.model';
import { PrescriptionApiService } from '../../services/prescription-api.service';
import { createPrescriptionItemForm } from './prescription-live-form';

@Component({
  selector: 'app-prescription-live-editor',
  standalone: true,
  styleUrls: ['../prescription-list/prescription-list.scss', './prescription-editor.scss'],
  imports: [ReactiveFormsModule],
  templateUrl: './prescription-live-editor.html',
})
export class PrescriptionLiveEditor {
  private readonly api = inject(PrescriptionApiService);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(ActiveRoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly prescriptionId = signal('');
  readonly newPatientId = signal('');
  readonly newConsultationId = signal('');
  readonly creating = signal(false);
  private requestNumber = 0;

  readonly detail = signal<PrescriptionDetailResponse | null>(null);
  readonly errors = signal<string[]>([]);
  readonly saving = signal(false);
  readonly deleteRequested = signal(false);
  readonly deleted = signal(false);
  readonly saveMessage = signal('');
  readonly needsReload = signal(false);
  readonly review = signal<PrescriptionInput | null>(null);
  readonly state = signal<'loading' | 'ready' | 'denied' | 'missing' | 'readonly' | 'error'>(
    'loading',
  );

  readonly textFields = [
    {
      key: 'medicine_name_snapshot',
      label: 'Medicine name',
      max: 200,
      required: true,
    },
    { key: 'dose_text', label: 'Dose', max: 200, required: true },
    { key: 'route', label: 'Route', max: 100, required: false },
    { key: 'frequency', label: 'Frequency', max: 200, required: true },
  ] as const;

  readonly form = new FormGroup({
    starts_on: new FormControl('', { nonNullable: true }),
    ends_on: new FormControl('', { nonNullable: true }),
    items: new FormArray<ReturnType<typeof createPrescriptionItemForm>>([]),
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';

      this.prescriptionId.set(id);
      this.creating.set(id === 'new');
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.newPatientId.set(params.get('patientId')?.trim() ?? '');
      this.newConsultationId.set(params.get('consultationId')?.trim() ?? '');
    });

    effect(() => {
      const id = this.prescriptionId();
      const permitted = this.roles.activeRole() === 'Doctor';
      const patientId = this.newPatientId();
      const consultationId = this.newConsultationId();

      void this.load(id, permitted, patientId, consultationId);
    });

    this.destroyRef.onDestroy(() => {
      this.requestNumber++;
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.review.set(null);
      this.errors.set([]);
    });
  }

  reload(): void {
    if (this.creating() && this.needsReload()) {
      void this.router.navigate(['/workspace/doctor/prescriptions'], {
        queryParams: {
          patientId: this.newPatientId(),
          consultationId: this.newConsultationId(),
        },
      });
      return;
    }

    void this.load(
      this.prescriptionId(),
      this.roles.activeRole() === 'Doctor',
      this.newPatientId(),
      this.newConsultationId(),
    );
  }

  private async load(
    id: string,
    permitted: boolean,
    patientId: string,
    consultationId: string,
  ): Promise<void> {
    const requestNumber = ++this.requestNumber;

    this.detail.set(null);
    this.deleteRequested.set(false);
    this.deleted.set(false);
    this.saving.set(false);
    this.saveMessage.set('');
    this.needsReload.set(false);
    this.review.set(null);
    this.errors.set([]);
    this.form.controls.items.clear();
    this.form.reset({ starts_on: '', ends_on: '' });

    if (!permitted) {
      this.state.set('denied');
      return;
    }

    if (!id) {
      this.state.set('missing');
      return;
    }

    this.state.set('loading');

    try {
      if (id === 'new') {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(patientId) || !uuidPattern.test(consultationId)) {
          this.state.set('missing');
          return;
        }

        const profile = await this.auth.getOwnProfile();

        if (requestNumber !== this.requestNumber) return;

        if (!profile.roles.includes('doctor')) {
          this.state.set('denied');
          return;
        }

        this.form.controls.items.push(createPrescriptionItemForm());
        this.form.markAsPristine();
        this.form.markAsUntouched();
        this.state.set('ready');
        return;
      }
      const [result, profile] = await Promise.all([this.api.get(id), this.auth.getOwnProfile()]);

      if (requestNumber !== this.requestNumber) return;

      const prescription = result.prescription;

      const editable =
        profile.roles.includes('doctor') &&
        prescription.source === 'doctor' &&
        prescription.prescriber_user_id === profile.user.id &&
        prescription.status === 'draft' &&
        prescription.issued_at === null;

      if (!editable) {
        this.state.set('readonly');
        return;
      }

      this.form.patchValue({
        starts_on: prescription.starts_on ?? '',
        ends_on: prescription.ends_on ?? '',
      });

      for (const item of result.items) {
        this.form.controls.items.push(createPrescriptionItemForm(item));
      }

      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.detail.set(result);
      this.state.set('ready');
    } catch (error) {
      if (requestNumber !== this.requestNumber) return;

      const status = error instanceof HttpErrorResponse ? error.status : 0;

      this.state.set(
        status === 401 || status === 403 ? 'denied' : status === 404 ? 'missing' : 'error',
      );
    }
  }
  addMedicine(): void {
    if (this.state() !== 'ready' || this.roles.activeRole() !== 'Doctor') return;

    this.form.controls.items.push(createPrescriptionItemForm());
    this.form.markAsDirty();
  }

  removeMedicine(index: number): void {
    if (this.state() !== 'ready' || this.roles.activeRole() !== 'Doctor') return;

    if (index < 0 || index >= this.form.controls.items.length) return;

    this.form.controls.items.removeAt(index);
    this.form.markAsDirty();
  }
  reviewDraft(): void {
    this.review.set(null);
    this.errors.set([]);

    const detail = this.detail();

    if (
      this.state() !== 'ready' ||
      this.roles.activeRole() !== 'Doctor' ||
      this.saving() ||
      this.needsReload() ||
      (!detail && !this.creating())
    ) {
      return;
    }

    this.form.markAllAsTouched();

    const value = this.form.getRawValue();
    const problems: string[] = [];
    const items: PrescriptionItemInput[] = [];

    const startsOn = value.starts_on || null;
    const endsOn = value.ends_on || null;

    const validDate = (date: string): boolean => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

      const timestamp = Date.parse(date);

      return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
    };

    if ((startsOn && !validDate(startsOn)) || (endsOn && !validDate(endsOn))) {
      problems.push('Enter valid prescription dates.');
    }

    if (startsOn && endsOn && endsOn < startsOn) {
      problems.push('End date must be on or after the start date.');
    }

    if (this.form.invalid) {
      problems.push('Check the required fields, text lengths and duration.');
    }

    value.items.forEach((item, index) => {
      const label = `Medicine ${index + 1}`;
      const name = item.medicine_name_snapshot.trim();
      const dose = item.dose_text.trim();
      const frequency = item.frequency.trim();
      const quantity = item.quantity.trim() || null;
      const unit = item.quantity_unit.trim();

      if (!name || !dose || !frequency) {
        problems.push(`${label}: medicine name, dose and frequency are required.`);
      }

      if (
        quantity !== null &&
        (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0)
      ) {
        problems.push(
          `${label}: quantity must be positive, with up to 9 whole-number digits and 3 decimal places.`,
        );
      }

      if ((quantity !== null) !== (unit !== '')) {
        problems.push(`${label}: supply both quantity and quantity unit.`);
      }

      if (unit !== '' && unit !== 'tablet' && unit !== 'capsule' && unit !== 'mL') {
        problems.push(`${label}: select a supported quantity unit.`);
        return;
      }

      items.push({
        medicine_id: item.medicine_id,
        medicine_name_snapshot: name,
        dose_text: dose,
        route: item.route.trim() || null,
        frequency,
        duration_days: item.duration_days,
        instructions: item.instructions.trim() || null,
        quantity,
        quantity_unit: unit === '' ? null : unit,
        is_prn: item.is_prn,
      });
    });

    if (problems.length > 0) {
      this.errors.set(problems);
      return;
    }

    this.review.set({
      consultation_id: this.creating()
        ? this.newConsultationId()
        : (detail?.prescription.consultation_id ?? null),
      claimed_prescriber: this.creating()
        ? null
        : (detail?.prescription.claimed_prescriber ?? null),
      original_document_id: this.creating()
        ? null
        : (detail?.prescription.original_document_id ?? null),
      starts_on: startsOn,
      ends_on: endsOn,
      items,
    });
  }

  backToEditing(): void {
    this.review.set(null);
  }
  async saveDraft(): Promise<void> {
    const detail = this.detail();
    const payload = this.review();

    if (
      (!detail && !this.creating()) ||
      !payload ||
      this.state() !== 'ready' ||
      this.roles.activeRole() !== 'Doctor' ||
      this.saving() ||
      this.deleteRequested() ||
      this.needsReload()
    ) {
      return;
    }

    const requestNumber = this.requestNumber;
    let prescriptionId = detail?.prescription.id ?? '';

    this.saving.set(true);
    this.errors.set([]);
    this.saveMessage.set('');

    try {
      if (this.creating()) {
        const created = await this.api.create(this.newPatientId(), payload);

        prescriptionId = created.prescription.id;
      } else if (detail) {
        await this.api.update(prescriptionId, detail.prescription.version, payload);
      } else {
        this.saving.set(false);
        return;
      }
    } catch (error) {
      if (requestNumber !== this.requestNumber) return;

      const status = error instanceof HttpErrorResponse ? error.status : 0;

      if (status === 409) {
        this.needsReload.set(true);
        this.review.set(null);
        this.errors.set([
          'This draft has changed or can no longer be edited. Reload it before continuing.',
        ]);
      } else if (status === 401 || status === 403) {
        this.detail.set(null);
        this.review.set(null);
        this.form.controls.items.clear();
        this.form.reset({ starts_on: '', ends_on: '' });
        this.state.set('denied');
      } else {
        this.errors.set([
          status === 422
            ? 'The server rejected some draft fields. Return to editing and check them.'
            : this.creating()
              ? 'Saving could not be confirmed. Check the patient prescription list before creating another draft.'
              : 'Saving could not be confirmed. Reload the draft to check its latest saved content.',
        ]);

        if (status !== 422) {
          this.needsReload.set(true);
          this.review.set(null);
        }
      }

      this.saving.set(false);
      return;
    }

    if (requestNumber !== this.requestNumber) return;

    this.saving.set(false);
    this.review.set(null);
    this.needsReload.set(true);
    this.form.markAsPristine();
    this.saveMessage.set('Draft saved successfully.');

    try {
      const navigated = await this.router.navigate([
        '/workspace/doctor/prescriptions',
        prescriptionId,
      ]);

      if (!navigated && requestNumber === this.requestNumber) {
        this.saveMessage.set('Draft saved successfully. Reload to continue editing.');
      }
    } catch {
      if (requestNumber === this.requestNumber) {
        this.saveMessage.set('Draft saved successfully. Reload to continue editing.');
      }
    }
  }
  async confirmDelete(): Promise<void> {
    const detail = this.detail();

    if (
      !detail ||
      this.creating() ||
      this.state() !== 'ready' ||
      this.roles.activeRole() !== 'Doctor' ||
      this.saving() ||
      this.needsReload() ||
      this.deleted() ||
      !this.deleteRequested()
    ) {
      return;
    }

    const requestNumber = this.requestNumber;
    const prescription = detail.prescription;

    this.saving.set(true);
    this.review.set(null);
    this.errors.set([]);
    this.saveMessage.set('');

    try {
      await this.api.deleteDraft(prescription.id);
    } catch (error) {
      if (requestNumber !== this.requestNumber) return;

      const status = error instanceof HttpErrorResponse ? error.status : 0;

      this.deleteRequested.set(false);
      this.saving.set(false);

      if (status === 401 || status === 403) {
        this.detail.set(null);
        this.form.controls.items.clear();
        this.form.reset({ starts_on: '', ends_on: '' });
        this.state.set('denied');
      } else {
        this.needsReload.set(true);
        this.errors.set([
          status === 409
            ? 'This draft cannot currently be deleted. Reload it to check its latest state.'
            : 'Deletion could not be confirmed. Reload to check whether the draft still exists.',
        ]);
      }

      return;
    }

    if (requestNumber !== this.requestNumber) return;

    this.deleted.set(true);
    this.deleteRequested.set(false);
    this.saving.set(false);
    this.detail.set(null);
    this.form.controls.items.clear();
    this.form.reset({ starts_on: '', ends_on: '' });

    try {
      await this.router.navigate(['/workspace/doctor/prescriptions'], {
        queryParams: {
          patientId: prescription.patient_user_id,
          consultationId: prescription.consultation_id,
        },
      });
    } catch {
      // The deleted state remains visible if navigation fails.
    }
  }
}
