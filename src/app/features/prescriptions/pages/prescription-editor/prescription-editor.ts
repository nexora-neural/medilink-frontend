import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { SAMPLE_DOCTOR_ID } from '../../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionItem,
  PrescriptionPageState,
} from '../../models/prescription-draft.model';
import {
  draftProblems,
  PrescriptionDraftInput,
  PrescriptionDraftPreviewStore,
} from '../../services/prescription-draft-preview.store';

function itemForm(item: PrescriptionItem) {
  return new FormGroup({
    id: new FormControl(item.id, { nonNullable: true }),
    medicineName: new FormControl(item.medicineName, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    dose: new FormControl(item.dose, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    route: new FormControl(item.route, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    frequency: new FormControl(item.frequency, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    durationDays: new FormControl<number | null>(item.durationDays, {
      validators: [Validators.required, Validators.min(1)],
    }),
    quantity: new FormControl<number | null>(item.quantity, {
      validators: [Validators.required, Validators.min(Number.MIN_VALUE)],
    }),
    quantityUnit: new FormControl(item.quantityUnit, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    instructions: new FormControl(item.instructions, {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    isPrn: new FormControl(item.isPrn, { nonNullable: true }),
  });
}

@Component({
  selector: 'app-prescription-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './prescription-editor.html',
  styleUrls: ['../prescription-list/prescription-list.scss', './prescription-editor.scss'],
})
export class PrescriptionEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PrescriptionDraftPreviewStore);

  readonly prescriptionId = signal('');
  readonly pageState = signal<PrescriptionPageState>('ready');
  readonly errors = signal<string[]>([]);
  readonly review = signal<PrescriptionDraftInput | null>(null);

  readonly textFields = [
    { key: 'medicineName', label: 'Medicine name', max: 200 },
    { key: 'dose', label: 'Dose', max: 200 },
    { key: 'route', label: 'Route', max: 100 },
    { key: 'frequency', label: 'Frequency', max: 200 },
  ] as const;

  readonly form = new FormGroup({
    startsOn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    endsOn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    items: new FormArray<ReturnType<typeof itemForm>>([]),
  });

  readonly permitted = computed(() => this.roles.activeRole() === 'Doctor');

  readonly prescription = computed(() =>
    this.permitted() && this.pageState() === 'ready'
      ? this.store.find(this.prescriptionId())
      : null,
  );

  readonly editable = computed(() => {
    const prescription = this.prescription();

    return prescription !== null && canEditPrescriptionDraft(prescription, SAMPLE_DOCTOR_ID);
  });

  get items() {
    return this.form.controls.items;
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.prescriptionId.set(params.get('id') ?? '');
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );
    });

    effect(() => {
      const prescription = this.prescription();
      const editable = this.editable();

      untracked(() => {
        this.review.set(null);
        this.errors.set([]);
        this.items.clear({ emitEvent: false });
        this.form.reset({ startsOn: '', endsOn: '' }, { emitEvent: false });

        if (!editable || !prescription) return;

        this.form.patchValue(
          {
            startsOn: prescription.startsOn,
            endsOn: prescription.endsOn,
          },
          { emitEvent: false },
        );

        for (const item of prescription.items) {
          this.items.push(itemForm(item), { emitEvent: false });
        }

        this.form.markAsPristine();
        this.form.markAsUntouched();
      });
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.review.set(null);
      this.errors.set([]);
    });
  }

  addMedicine(): void {
    if (!this.editable()) return;

    this.items.push(
      itemForm({
        id: `sample-item-${crypto.randomUUID()}`,
        medicineName: '',
        dose: '',
        route: '',
        frequency: '',
        durationDays: 1,
        quantity: 1,
        quantityUnit: 'tablet',
        instructions: '',
        isPrn: false,
      }),
    );

    this.form.markAsDirty();
  }

  removeMedicine(index: number): void {
    if (!this.editable() || index < 0 || index >= this.items.length) {
      return;
    }

    this.items.removeAt(index);
    this.form.markAsDirty();
  }

  reviewDraft(): void {
    if (!this.editable()) return;

    this.form.markAllAsTouched();

    const value = this.form.getRawValue();
    const input: PrescriptionDraftInput = {
      startsOn: value.startsOn,
      endsOn: value.endsOn,
      items: value.items.map((item) => ({
        ...item,
        durationDays: item.durationDays ?? Number.NaN,
        quantity: item.quantity ?? Number.NaN,
      })),
    };

    const problems = draftProblems(input);
    this.errors.set(problems);

    if (this.form.invalid || problems.length > 0) {
      this.review.set(null);
      return;
    }

    this.review.set(input);
  }

  backToEditing(): void {
    this.review.set(null);
  }

  saveDraft(): void {
    const input = this.review();
    const current = this.store.find(this.prescriptionId());

    if (
      !this.editable() ||
      !input ||
      !current ||
      !canEditPrescriptionDraft(current, SAMPLE_DOCTOR_ID)
    ) {
      return;
    }

    try {
      const saved = this.store.save(current.id, input);
      this.form.markAsPristine();

      void this.router.navigate(['/workspace/doctor/prescriptions', saved.id]);
    } catch {
      this.errors.set([
        'The sample draft could not be saved. Return to editing and review the fields.',
      ]);
    }
  }

  retry(): void {
    if (this.permitted() && this.pageState() === 'error') {
      this.pageState.set('ready');
    }
  }
}
