import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

export interface VerificationApplication {
  id: string;
  role: 'doctor' | 'pharmacist' | 'lab_staff';
  registration_number: string | null;
  organization_id?: string | null;
  status:
    'not_submitted' | 'pending' | 'approved' | 'rejected' | 'more_info_requested' | 'suspended';
  submitted_at: string;
  evidence_document_ids: string[];
}

export interface VerificationDocument {
  id: string;
  original_filename: string;
}

export interface Organization {
  id: string;
  name: string;
  type: 'clinic' | 'hospital' | 'pharmacy' | 'laboratory' | 'other';
}

interface ApplicationsPage {
  items: VerificationApplication[];
  page: number;
  page_size: number;
  total: number;
}

interface OrganizationsPage {
  items: Organization[];
  page: number;
  page_size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ProfessionalVerificationService {
  private readonly auth = inject(AuthService);

  updateProfile(input: {
    role: VerificationApplication['role'];
    registration_number: string;
    qualifications: string | null;
    specialty: string | null;
  }): Promise<unknown> {
    return this.auth.putAuthorized('me/professional-profile', input);
  }

  listOrganizations(): Promise<OrganizationsPage> {
    return this.auth.getAuthorized<OrganizationsPage>('organizations?page=1&page_size=100');
  }

  uploadEvidence(file: File): Promise<VerificationDocument> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('document_type', 'verification_evidence');

    return this.auth.postAuthorizedForm<VerificationDocument>('me/verification-documents', body);
  }

  submit(input: {
    role: VerificationApplication['role'];
    registration_number: string;
    evidence_document_ids: string[];
    organization_id?: string;
  }): Promise<VerificationApplication> {
    return this.auth.postAuthorized<VerificationApplication>('verification-applications', input);
  }

  listOwn(): Promise<ApplicationsPage> {
    return this.auth.getAuthorized<ApplicationsPage>('me/verification-applications');
  }

  getDocument(id: string): Promise<VerificationDocument> {
    return this.auth.getAuthorized<VerificationDocument>(`documents/${encodeURIComponent(id)}`);
  }

  download(id: string): Promise<Blob> {
    return this.auth.getAuthorizedBlob(`documents/${encodeURIComponent(id)}/content`);
  }
}
