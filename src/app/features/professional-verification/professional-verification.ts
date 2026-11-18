import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService, MeResponse } from '../../core/auth.service';
import { DocumentUpload } from '../../shared/components/document-upload/document-upload';
import { DocumentDownload } from '../../shared/components/document-download/document-download';
import {
  Organization,
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
  private readonly auth = inject(AuthService);

  readonly roles = [
    { label: 'Doctor', value: 'doctor' },
    { label: 'Pharmacist', value: 'pharmacist' },
    { label: 'Lab Staff', value: 'lab_staff' },
  ] as const;

  readonly verificationForm = this.formBuilder.nonNullable.group({
    role: ['', Validators.required],
    registrationNumber: ['', [Validators.required, nonblank, Validators.maxLength(100)]],
    organizationId: [''],
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
  organizations: Organization[] = [];

  submissionError = '';
  fileError = '';
  loadError = '';
  organizationLoadError = '';

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

  private profile: MeResponse['professional_profile'] = null;

  private readonly uploadedFiles = new Map<File, VerificationDocument>();

  async ngOnInit(): Promise<void> {
    await this.loadApplication();
  }

  get statusLabel(): string {
    const status = this.application?.status;

    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'suspended') return 'Suspended';

    if (status === 'more_info_requested') {
      return 'More information requested';
    }

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
        return 'Application approved';

      case 'rejected':
        return 'Application rejected';

      case 'suspended':
        return 'Application suspended';

      case 'more_info_requested':
        return 'More information requested';

      default:
        return 'Your application is pending review';
    }
  }

  get organizationName(): string {
    const organizationId =
      this.application?.organization_id ?? this.verificationForm.controls.organizationId.value;

    return this.organizations.find((item) => item.id === organizationId)?.name ?? '';
  }

  private getProfessionalRole(value: string): VerificationApplication['role'] | '' {
    const role = this.roles.find((item) => item.value === value);
    return role?.value ?? '';
  }

  private restoreProfessionalProfile(application: VerificationApplication | null): void {
    const profile = this.profile;

    const role = this.getProfessionalRole(application?.role ?? profile?.role ?? '');

    this.verificationForm.patchValue({
      role,
      registrationNumber: application?.registration_number ?? profile?.registration_number ?? '',
      organizationId: application?.organization_id ?? '',
      specialty: profile?.specialty ?? '',
      qualification: profile?.qualifications ?? '',
    });

    if (application) {
      this.submittedSnapshot = {
        role: this.roles.find((item) => item.value === application.role)?.label ?? '',
        registrationNumber: application.registration_number ?? '',
        institution: this.organizationName,
        qualification: profile?.qualifications ?? '',
        documents: this.documents.map((item) => item.original_filename),
      };
    }
  }

  onDocumentsChanged(files: File[]): void {
    if (this.busy) return;

    this.selectedFiles = files;
    this.fileError = '';
  }

  async submitApplication(): Promise<void> {
    if (this.busy || (this.application && !this.canSubmitAgain)) {
      return;
    }

    this.submitted = true;
    this.fileError = '';
    this.verificationForm.markAllAsTouched();

    if (this.verificationForm.invalid || !this.selectedFiles.length) {
      if (!this.selectedFiles.length) {
        this.fileError = 'Please upload your supporting document.';
      }

      if (this.verificationForm.invalid) {
        this.showDocuments = false;
      }

      return;
    }

    this.busy = true;
    this.submissionError = '';

    try {
      const form = this.verificationForm.getRawValue();
      const role = form.role as VerificationApplication['role'];
      const registrationNumber = form.registrationNumber.trim();
      const organizationId = form.organizationId.trim();

      await this.verification.updateProfile({
        role,
        registration_number: registrationNumber,
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
        registration_number: registrationNumber,
        evidence_document_ids: uploaded.map((document) => document.id),
        ...(organizationId ? { organization_id: organizationId } : {}),
      });

      this.documents = uploaded;

      this.submittedSnapshot = {
        role: this.roleLabel,
        registrationNumber,
        institution: this.organizationName,
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

      document.body.appendChild(link);
      link.click();
      link.remove();

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
    this.organizationLoadError = '';

    try {
      const [applicationResult, profileResult, organizationResult] = await Promise.allSettled([
        this.verification.listOwn(),
        this.auth.getOwnProfile(),
        this.verification.listOrganizations(),
      ]);

      if (applicationResult.status === 'rejected') {
        throw applicationResult.reason;
      }

      this.profile =
        profileResult.status === 'fulfilled' ? profileResult.value.professional_profile : null;

      this.organizations =
        organizationResult.status === 'fulfilled' ? organizationResult.value.items : [];

      if (organizationResult.status === 'rejected') {
        this.organizationLoadError =
          'Organizations could not be loaded. You can still submit without selecting one.';
      }

      this.application = applicationResult.value.items[0] ?? null;
      this.applicationSubmitted = this.application !== null;

      if (this.application) {
        this.documents = await Promise.all(
          this.application.evidence_document_ids.map((id) => this.verification.getDocument(id)),
        );

        this.showStatus = true;
      } else {
        this.documents = [];
        this.showStatus = false;
      }

      this.restoreProfessionalProfile(this.application);
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
      this.submitted = false;
      this.submissionError = '';
      this.fileError = '';
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
      if (error.status === 401) {
        return 'Your session has expired. Sign in again and retry.';
      }

      if (error.status === 403) {
        return 'You are not permitted to access this verification resource.';
      }

      if (error.status === 0 || error.status >= 500) {
        return 'The service is unavailable. Please try again later.';
      }

      const detail = error.error?.detail;

      if (typeof detail === 'string') {
        return detail;
      }

      if (detail && typeof detail.message === 'string') {
        return detail.message;
      }
    }

    return fallback;
  }
}
