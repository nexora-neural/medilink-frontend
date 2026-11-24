import { Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DocumentUpload } from '../../shared/components/document-upload/document-upload';
import { UiState } from '../../shared/components/ui-state/ui-state';
import {
  PATIENT_PRESCRIPTIONS_STORE,
  PatientPrescriptionsPreviewStore,
  PatientPrescription,
  PrescriptionDraft,
} from './patient-prescriptions.store';

const requiredText = [Validators.required, Validators.pattern(/\S/)];
const medicine = () =>
  new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [...requiredText, Validators.maxLength(160)],
    }),
    strength: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    instructions: new FormControl('', {
      nonNullable: true,
      validators: [...requiredText, Validators.maxLength(500)],
    }),
  });
@Component({
  selector: 'app-patient-prescriptions',
  providers: [{ provide: PATIENT_PRESCRIPTIONS_STORE, useClass: PatientPrescriptionsPreviewStore }],
  imports: [ReactiveFormsModule, RouterLink, DocumentUpload, UiState],
  templateUrl: './patient-prescriptions.html',
  styleUrl: './patient-prescriptions.scss',
})
export class PatientPrescriptions implements OnInit {
  private readonly store = inject(PATIENT_PRESCRIPTIONS_STORE);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly records = signal<PatientPrescription[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly view = signal<'list' | 'form' | 'review' | 'detail'>('list');
  readonly selected = signal<PatientPrescription | null>(null);
  readonly files = signal<File[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly today = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();
  readonly form = new FormGroup({
    prescribedOn: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control) => {
          const value = control.value as string;
          return value &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              Number.isNaN(Date.parse(value)) ||
              new Date(value).toISOString().slice(0, 10) !== value ||
              value > this.today)
            ? { date: true }
            : null;
        },
      ],
    }),
    prescriber: new FormControl('', {
      nonNullable: true,
      validators: [...requiredText, Validators.maxLength(160)],
    }),
    clinic: new FormControl('', {
      nonNullable: true,
      validators: [...requiredText, Validators.maxLength(160)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    confirmation: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });
  readonly medicines = [medicine()];
  get valid(): boolean {
    return this.form.valid && this.medicines.every((group) => group.valid);
  }
  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.records.set(await this.store.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
  private navigate(view: 'list' | 'form' | 'review' | 'detail'): void {
    this.view.set(view);
    // Wait until Angular renders the target view before moving keyboard focus.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('h2[tabindex]')?.focus());
  }
  add(): void {
    if (this.saving()) return;
    this.form.reset();
    this.medicines.splice(0);
    this.medicines.push(medicine());
    this.files.set([]);
    this.error.set('');
    this.message.set('');
    this.navigate('form');
  }
  addMedicine(): void {
    if (this.medicines.length < 20) this.medicines.push(medicine());
  }
  removeMedicine(index: number): void {
    if (this.medicines.length > 1) this.medicines.splice(index, 1);
  }
  fieldError(control: FormControl): boolean {
    return control.touched && control.invalid;
  }
  review(): void {
    this.form.markAllAsTouched();
    this.medicines.forEach((group) => group.markAllAsTouched());
    if (!this.valid) {
      this.error.set('Check the highlighted fields and confirm the information.');
      setTimeout(() =>
        this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    this.error.set('');
    this.navigate('review');
  }
  edit(): void {
    if (!this.saving()) {
      this.error.set('');
      this.navigate('form');
    }
  }
  cancel(): void {
    if (!this.saving()) {
      this.error.set('');
      this.navigate('list');
    }
  }
  details(record: PatientPrescription): void {
    this.selected.set(record);
    this.navigate('detail');
  }
  draft(): PrescriptionDraft {
    const value = this.form.getRawValue();
    return {
      prescribedOn: value.prescribedOn,
      prescriber: value.prescriber.trim(),
      clinic: value.clinic.trim(),
      notes: value.notes.trim(),
      medicines: this.medicines
        .map((group) => group.getRawValue())
        .map((m) => ({
          name: m.name.trim(),
          strength: m.strength.trim(),
          instructions: m.instructions.trim(),
        })),
      evidence: [...this.files()],
    };
  }
  async save(): Promise<void> {
    if (this.saving() || this.view() !== 'review' || !this.valid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const record = await this.store.add(this.draft());
      this.records.update((records) => [record, ...records]);
      this.selected.set(record);
      this.message.set(
        'Added to this preview session. This prescription is not clinically verified.',
      );
      this.navigate('detail');
    } catch {
      this.error.set(
        'Unable to add the prescription. Your entries are still available. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
