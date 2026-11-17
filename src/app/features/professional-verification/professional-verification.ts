import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DocumentUpload } from '../../shared/components/document-upload/document-upload';
import { DocumentDownload } from '../../shared/components/document-download/document-download';
import {
  ProfessionalVerificationService,
  VerificationApplication,
  VerificationDocument,
} from './professional-verification.service';

const nonblank = (control: AbstractControl) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Component({
  selector: 'app-professional-verification',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, DocumentUpload, DocumentDownload],
  templateUrl: './professional-verification.html',
  styleUrl: './professional-verification.scss',
})
export class ProfessionalVerification implements OnInit {
  @ViewChild('formHeading') formHeading?: ElementRef<HTMLElement>;
  @ViewChild('documentsHeading') documentsHeading?: ElementRef<HTMLElement>;
  @ViewChild('statusHeading') statusHeading?: ElementRef<HTMLElement>;
  private readonly formBuilder = new FormBuilder();
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly verification = inject(ProfessionalVerificationService);

  readonly roles = [
    { label: 'Doctor', value: 'doctor' },
    { label: 'Pharmacist', value: 'pharmacist' },
    { label: 'Lab Staff', value: 'lab_staff' },
  ] as const;

  readonly verificationForm = this.formBuilder.nonNullable.group({
    role: ['', Validators.required],
    registrationNumber: ['', [Validators.required, nonblank, Validators.maxLength(100)]],
    specialty: ['', Validators.maxLength(150)],
    qualification: ['', Validators.maxLength(2000)],
  });

  selectedFiles: File[] = [];
  submittedSnapshot: {
    role: string;
    registrationNumber: string;
    institution: string;
    qualification: string;
    documents: string[];
  } | null = null;
  application: VerificationApplication | null = null;
  documents: VerificationDocument[] = [];
  submissionError = '';
  fileError = '';
  loadError = '';
  applicationSubmitted = false;
  showStatus = false;
  showDocuments = false;
  submitted = false;
  busy = false;
  loading = true;
  downloadingId = '';
  downloadError = '';
  downloadMessage = '';
  downloadResultId = '';
  private readonly uploadedFiles = new Map<File, VerificationDocument>();

  async ngOnInit(): Promise<void> {
    await this.loadApplication();
  }

  get statusLabel(): string {
    const status = this.application?.status;
    if (status === 'approved' || status === 'verified') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'suspended') return 'Suspended';
    if (status === 'more_info_requested') return 'More information requested';
    if (status === 'under_review') return 'Under review';
    return 'Pending review';
  }

  get roleLabel(): string {
    return this.roles.find((role) => role.value === this.application?.role)?.label ?? '';
  }

  get canSubmitAgain(): boolean {
    return (
      this.application?.status === 'rejected' || this.application?.status === 'more_info_requested'
    );
  }

  get statusHeadingText(): string {
    switch (this.application?.status) {
      case 'approved':
      case 'verified':
        return 'Application approved';
      case 'rejected':
        return 'Application rejected';
      case 'suspended':
        return 'Application suspended';
      case 'more_info_requested':
        return 'More information requested';
      case 'under_review':
        return 'Application under review';
      default:
        return 'Your application is pending review';
    }
  }

  onDocumentsChanged(files: File[]): void {
    if (this.busy) return;
    this.selectedFiles = files;
    this.fileError = '';
  }

  async submitApplication(): Promise<void> {
    if (this.busy || (this.application && !this.canSubmitAgain)) return;
    this.submitted = true;
    this.fileError = '';
    this.verificationForm.markAllAsTouched();
    if (this.verificationForm.invalid || !this.selectedFiles.length) {
      if (!this.selectedFiles.length) this.fileError = 'Please upload your supporting document.';
      if (this.verificationForm.invalid) this.showDocuments = false;
      return;
    }

    this.busy = true;
    this.submissionError = '';
    try {
      const form = this.verificationForm.getRawValue();
      const role = form.role as VerificationApplication['role'];
      await this.verification.updateProfile({
        role,
        registration_number: form.registrationNumber.trim(),
        qualifications: form.qualification.trim() || null,
        specialty: form.specialty.trim() || null,
      });
      const uploaded = await Promise.all(
        this.selectedFiles.map(async (file) => {
          const existing = this.uploadedFiles.get(file);
          if (existing) return existing;
          const document = await this.verification.uploadEvidence(file);
          this.uploadedFiles.set(file, document);
          return document;
        }),
      );
      this.application = await this.verification.submit({
        role,
        registration_number: form.registrationNumber.trim(),
        evidence_document_ids: uploaded.map((document) => document.id),
      });
      this.documents = uploaded;
      this.submittedSnapshot = {
        role: this.roleLabel,
        registrationNumber: form.registrationNumber.trim(),
        institution: '',
        qualification: form.qualification.trim(),
        documents: uploaded.map((document) => document.original_filename),
      };
      this.applicationSubmitted = true;
      this.showStatus = true;
      setTimeout(() => this.statusHeading?.nativeElement.focus());
    } catch (error) {
      this.submissionError = this.describeError(
        error,
        'Unable to submit your application. Please try again.',
      );
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  async downloadDocument(documentId: string): Promise<void> {
    if (this.downloadingId) return;
    this.downloadingId = documentId;
    this.downloadResultId = documentId;
    this.downloadError = '';
    this.downloadMessage = '';
    try {
      const [metadata, content] = await Promise.all([
        this.verification.getDocument(documentId),
        this.verification.download(documentId),
      ]);
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.original_filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.downloadMessage = 'Document downloaded.';
    } catch (error) {
      this.downloadError = this.describeError(error, 'The document could not be downloaded.');
      this.downloadResultId = documentId;
    } finally {
      this.downloadingId = '';
      this.changeDetector.markForCheck();
    }
  }

  async loadApplication(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const result = await this.verification.listOwn();
      this.application = result.items[0] ?? null;
      this.applicationSubmitted = this.application !== null;
      if (this.application) {
        this.documents = await Promise.all(
          this.application.evidence_document_ids.map((id) => this.verification.getDocument(id)),
        );
        this.submittedSnapshot = {
          role: this.roleLabel,
          registrationNumber: this.application.registration_number ?? '',
          institution: '',
          qualification: '',
          documents: this.documents.map((item) => item.original_filename),
        };
        this.showStatus = true;
      }
    } catch (error) {
      this.loadError = this.describeError(error, 'Your application could not be loaded.');
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  viewApplicationForm(): void {
    if (this.canSubmitAgain) {
      this.application = null;
      this.applicationSubmitted = false;
      this.documents = [];
      this.selectedFiles = [];
      this.uploadedFiles.clear();
      this.verificationForm.reset();
      this.submitted = false;
      this.submissionError = '';
    }
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

  private describeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Your session has expired. Sign in again and retry.';
      if (error.status === 403)
        return 'You are not permitted to access this verification resource.';
      if (error.status === 0 || error.status >= 500)
        return 'The service is unavailable. Please try again later.';
      const detail = error.error?.detail;
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail.message === 'string') return detail.message;
    }
    return fallback;
  }
}
