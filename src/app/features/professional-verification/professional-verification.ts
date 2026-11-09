import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-professional-verification',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './professional-verification.html',
  styleUrl: './professional-verification.scss',
})
export class ProfessionalVerification {
  private readonly formBuilder = new FormBuilder();

  readonly roles = ['Doctor', 'Pharmacist', 'Lab Staff'];

  readonly verificationForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
    registrationNumber: ['', Validators.required],
    specialty: ['', Validators.required],
    institution: ['', Validators.required],
    notes: [''],
  });

  selectedFile: File | null = null;
  fileError = '';
  applicationSubmitted = false;
  showStatus = false;
  submitted = false;
  busy = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.fileError = '';
    this.selectedFile = null;

    if (!file) return;

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(extension)) {
      this.fileError = 'Please upload a PDF, JPG or PNG file.';
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.fileError = 'File size must be 10 MB or less.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.fileError = '';

    const input = document.getElementById('evidence-document') as HTMLInputElement | null;

    if (input) input.value = '';
  }

  submitApplication(): void {
    this.submitted = true;
    this.fileError = '';

    this.verificationForm.markAllAsTouched();

    if (this.verificationForm.invalid || !this.selectedFile) {
      if (!this.selectedFile) {
        this.fileError = 'Please upload your supporting document.';
      }
      return;
    }

    // Frontend-only preview. API submission will be handled separately.
    this.applicationSubmitted = true;
    this.showStatus = true;
  }

  viewApplicationForm(): void {
    this.showStatus = false;
  }

  viewApplicationStatus(): void {
    this.showStatus = true;
  }
}
