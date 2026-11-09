import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

const nonblank = (control: AbstractControl) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Component({
  selector: 'app-professional-verification',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './professional-verification.html',
  styleUrl: './professional-verification.scss',
})
export class ProfessionalVerification {
  @ViewChild('formHeading') formHeading?: ElementRef<HTMLElement>;
  @ViewChild('documentsHeading') documentsHeading?: ElementRef<HTMLElement>;
  @ViewChild('statusHeading') statusHeading?: ElementRef<HTMLElement>;
  private readonly formBuilder = new FormBuilder();
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly roles = ['Doctor', 'Pharmacist', 'Lab Staff'];

  readonly verificationForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, nonblank]],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
    registrationNumber: ['', [Validators.required, nonblank, Validators.maxLength(100)]],
    specialty: ['', Validators.maxLength(150)],
    institution: [''],
    qualification: ['', Validators.maxLength(2000)],
    notes: [''],
  });

  selectedFiles: File[] = [];
  submittedSnapshot: {
    role: string;
    registrationNumber: string;
    institution: string;
    qualification: string;
    documents: string[];
  } | null = null;
  previewStatus: 'pending' | 'under_review' | 'verified' | 'rejected' | 'more_info_requested' =
    'pending';
  submissionError = '';
  fileError = '';
  applicationSubmitted = false;
  showStatus = false;
  showDocuments = false;
  submitted = false;
  busy = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    this.fileError = '';
    this.selectedFiles = [];

    if (!files.length) return;

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    if (
      files.some(
        (file) => !allowedExtensions.includes(file.name.split('.').pop()?.toLowerCase() ?? ''),
      )
    ) {
      this.fileError = 'Please upload a PDF, JPG or PNG file.';
      input.value = '';
      return;
    }

    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      this.fileError = 'File size must be 10 MB or less.';
      input.value = '';
      return;
    }

    this.selectedFiles = files;
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, itemIndex) => itemIndex !== index);
    this.fileError = '';

    const input = document.getElementById('evidence-document') as HTMLInputElement | null;

    if (input) input.value = '';
  }

  async submitApplication(): Promise<void> {
    if (this.busy) return;
    this.submitted = true;
    this.fileError = '';

    this.verificationForm.markAllAsTouched();

    if (this.verificationForm.invalid || !this.selectedFiles.length) {
      if (!this.selectedFiles.length) {
        this.fileError = 'Please upload your supporting document.';
      }
      if (this.verificationForm.invalid) this.showDocuments = false;
      return;
    }

    this.busy = true;
    this.submissionError = '';
    const { role, registrationNumber, institution, qualification } =
      this.verificationForm.getRawValue();
    const documents = this.selectedFiles.map((file) => file.name);
    try {
      await this.submitPreview();
      this.submittedSnapshot = {
        role,
        registrationNumber,
        institution,
        qualification,
        documents,
      };
      this.applicationSubmitted = true;
      this.previewStatus = 'pending';
      this.showStatus = true;
      setTimeout(() => this.statusHeading?.nativeElement.focus());
    } catch {
      this.submissionError = 'Unable to submit the preview. Please try again.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected async submitPreview(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }

  setPreviewStatus(status: string): void {
    if (
      status === 'pending' ||
      status === 'under_review' ||
      status === 'verified' ||
      status === 'rejected' ||
      status === 'more_info_requested'
    ) {
      this.previewStatus = status;
    }
  }

  viewApplicationForm(): void {
    this.showStatus = false;
    this.showDocuments = false;
    setTimeout(() => this.formHeading?.nativeElement.focus());
  }

  viewDocuments(): void {
    this.showStatus = false;
    this.showDocuments = true;
    setTimeout(() => this.documentsHeading?.nativeElement.focus());
  }

  viewApplicationStatus(): void {
    this.showStatus = true;
    setTimeout(() => this.statusHeading?.nativeElement.focus());
  }
}
