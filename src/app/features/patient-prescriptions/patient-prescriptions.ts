import { Component, ElementRef, OnDestroy, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DocumentUpload } from '../../shared/components/document-upload/document-upload';
import { UiState } from '../../shared/components/ui-state/ui-state';
import {
  PATIENT_PRESCRIPTIONS_STORE,
  PATIENT_PRESCRIPTION_OCR_PROCESSOR,
  PatientPrescriptionOcrPreviewProcessor,
  PatientPrescriptionsPreviewStore,
  PatientPrescription,
  PrescriptionDraft,
} from './patient-prescriptions.store';

type PrescriptionView =
  | 'list'
  | 'intake'
  | 'ocr-upload'
  | 'ocr-processing'
  | 'ocr-review'
  | 'ocr-error'
  | 'form'
  | 'review'
  | 'detail';

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

const prescriptionTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

@Component({
  selector: 'app-patient-prescriptions',
  providers: [
    { provide: PATIENT_PRESCRIPTIONS_STORE, useClass: PatientPrescriptionsPreviewStore },
    {
      provide: PATIENT_PRESCRIPTION_OCR_PROCESSOR,
      useClass: PatientPrescriptionOcrPreviewProcessor,
    },
  ],
  imports: [ReactiveFormsModule, RouterLink, DocumentUpload, UiState],
  templateUrl: './patient-prescriptions.html',
  styleUrl: './patient-prescriptions.scss',
})
export class PatientPrescriptions implements OnInit, OnDestroy {
  private readonly store = inject(PATIENT_PRESCRIPTIONS_STORE);
  private readonly ocrProcessor = inject(PATIENT_PRESCRIPTION_OCR_PROCESSOR);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private originalObjectUrl = '';

  readonly records = signal<PatientPrescription[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly view = signal<PrescriptionView>('list');
  readonly selected = signal<PatientPrescription | null>(null);
  readonly files = signal<File[]>([]);
  readonly originalImageUrl = signal('');
  readonly originalPdfUrl = signal<SafeResourceUrl | null>(null);
  readonly originalFileType = signal('');
  readonly entrySource = signal<'manual' | 'ocr'>('manual');
  readonly ocrInProgress = signal(false);
  readonly ocrError = signal('');
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

  ngOnDestroy(): void {
    this.releaseOriginalPreview();
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

  private navigate(view: PrescriptionView): void {
    this.view.set(view);
    // Wait until Angular renders the target view before moving keyboard focus.
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('h2[tabindex]')?.focus());
  }

  private resetEntry(): void {
    this.form.reset();
    this.medicines.splice(0);
    this.medicines.push(medicine());
    this.files.set([]);
    this.selected.set(null);
    this.entrySource.set('manual');
    this.ocrError.set('');
    this.error.set('');
    this.message.set('');
    this.releaseOriginalPreview();
  }

  add(): void {
    if (this.saving()) return;
    this.resetEntry();
    this.navigate('intake');
  }

  startManualEntry(): void {
    if (this.saving()) return;
    this.entrySource.set('manual');
    this.navigate('form');
  }

  chooseOcrUpload(): void {
    this.ocrError.set('');
    this.navigate('ocr-upload');
  }

  backToIntake(): void {
    this.ocrError.set('');
    this.navigate('intake');
  }

  backToOcrUpload(): void {
    this.ocrError.set('');
    this.navigate('ocr-upload');
  }

  onOcrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Allow selecting the same file again after an error or file replacement.
    input.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const expectedType = prescriptionTypes[extension];
    if (file.size === 0) {
      this.ocrError.set('This file is empty. Choose a readable prescription file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.ocrError.set('The file is too large. Choose a file up to 10 MiB.');
      return;
    }
    if (!expectedType) {
      this.ocrError.set('Choose a PDF, JPEG or PNG prescription.');
      return;
    }
    if (file.type && file.type.toLowerCase() !== expectedType) {
      this.ocrError.set(
        'The file type does not match its extension. Choose a valid PDF, JPEG or PNG.',
      );
      return;
    }

    this.files.set([file]);
    this.ocrError.set('');
    this.createOriginalPreview(file, file.type || expectedType);
  }

  removeOcrFile(): void {
    this.files.set([]);
    this.ocrError.set('');
    this.releaseOriginalPreview();
  }

  private createOriginalPreview(file: File, mimeType: string): void {
    this.releaseOriginalPreview();
    this.originalFileType.set(mimeType);
    if (typeof URL.createObjectURL !== 'function') return;
    try {
      this.originalObjectUrl = URL.createObjectURL(file);
      if (mimeType.startsWith('image/')) this.originalImageUrl.set(this.originalObjectUrl);
      if (mimeType === 'application/pdf') {
        this.originalPdfUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.originalObjectUrl),
        );
      }
    } catch {
      this.releaseOriginalPreview();
      this.originalImageUrl.set('');
      this.originalPdfUrl.set(null);
    }
  }

  private releaseOriginalPreview(): void {
    if (this.originalObjectUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.originalObjectUrl);
    }
    this.originalObjectUrl = '';
    this.originalImageUrl.set('');
    this.originalPdfUrl.set(null);
    this.originalFileType.set('');
  }

  async startOcr(): Promise<void> {
    if (this.ocrInProgress()) return;
    const file = this.files()[0];
    if (!file) {
      this.ocrError.set('Choose a prescription file before starting the review.');
      this.navigate('ocr-upload');
      return;
    }

    this.error.set('');
    this.ocrError.set('');
    this.ocrInProgress.set(true);
    this.navigate('ocr-processing');
    try {
      const result = await this.ocrProcessor.extract(file);
      if (result.status === 'unreadable' || result.draft.medicines.length === 0) {
        this.ocrError.set(
          'We could not read printed English text from this file. Try a clearer copy or enter the details manually.',
        );
        this.navigate('ocr-error');
        return;
      }

      this.form.reset({
        prescribedOn: result.draft.prescribedOn,
        prescriber: result.draft.prescriber,
        clinic: result.draft.clinic,
        notes: result.draft.notes,
        confirmation: false,
      });
      this.medicines.splice(0);
      for (const item of result.draft.medicines) {
        const group = medicine();
        group.patchValue(item);
        this.medicines.push(group);
      }
      this.entrySource.set('ocr');
      this.navigate('ocr-review');
    } catch {
      this.ocrError.set(
        'Prescription text extraction failed. Retry with the original file or enter the details manually.',
      );
      this.navigate('ocr-error');
    } finally {
      this.ocrInProgress.set(false);
    }
  }

  retryOcr(): Promise<void> {
    return this.startOcr();
  }

  useManualEntry(): void {
    this.form.reset();
    this.medicines.splice(0);
    this.medicines.push(medicine());
    this.entrySource.set('manual');
    this.ocrError.set('');
    this.error.set('');
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
      this.error.set(
        'Check the highlighted fields and confirm the information against the original.',
      );
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
      this.navigate(this.entrySource() === 'ocr' ? 'ocr-review' : 'form');
    }
  }

  cancel(): void {
    if (!this.saving()) {
      if (this.view() !== 'detail') this.resetEntry();
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
      this.releaseOriginalPreview();
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
