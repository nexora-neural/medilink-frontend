import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth.service';

export const applicationDecisions = ['Approved', 'Rejected', 'Information requested'] as const;
export type ApplicationDecision = (typeof applicationDecisions)[number];
export type ApplicationStatus =
  'Not submitted' | 'Pending' | 'Approved' | 'Rejected' | 'Information requested' | 'Suspended';

export interface Evidence {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
}

export interface DecisionRecord {
  decision: ApplicationDecision;
  reviewer: string;
  decidedAt: string;
  reason: string;
}

export interface ProfessionalApplication {
  id: string;
  userId: string;
  name: string;
  role: 'Doctor' | 'Pharmacist' | 'Lab Staff';
  organization: string;
  registration: string;
  status: ApplicationStatus;
  evidence: readonly Evidence[];
  history: readonly DecisionRecord[];
}

export interface DecisionSaveResult {
  application: ProfessionalApplication;
  detailsReloaded: boolean;
}

interface ApiPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

interface ApiApplication {
  id: string;
  user_id: string;
  organization_id: string | null;
  role: 'doctor' | 'pharmacist' | 'lab_staff';
  registration_number: string | null;
  workplace: string | null;
  status:
    'not_submitted' | 'pending' | 'approved' | 'rejected' | 'more_info_requested' | 'suspended';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  evidence_document_ids: string[];
  applicant_display_name: string | null;
  organization_name: string | null;
}

interface ApiDecision {
  id: string;
  application_id: string;
  reviewer_user_id: string;
  decision: 'approved' | 'rejected' | 'more_info_requested';
  reason: string;
  decided_at: string;
  reviewer_display_name: string | null;
}

interface ApiDocument {
  id: string;
  document_type: string;
  original_filename: string;
  created_at: string;
}

interface ApiOrganization {
  id: string;
  name: string;
}

const roleLabels: Record<ApiApplication['role'], ProfessionalApplication['role']> = {
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  lab_staff: 'Lab Staff',
};

const statusLabels: Record<ApiApplication['status'], ApplicationStatus> = {
  not_submitted: 'Not submitted',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  more_info_requested: 'Information requested',
  suspended: 'Suspended',
};

const decisionLabels: Record<ApiDecision['decision'], ApplicationDecision> = {
  approved: 'Approved',
  rejected: 'Rejected',
  more_info_requested: 'Information requested',
};

export function canReview(status: ApplicationStatus): boolean {
  return status === 'Pending';
}

@Injectable({ providedIn: 'root' })
export class ProfessionalApplicationsService {
  private readonly auth = inject(AuthService);
  private readonly base = 'admin/verification-applications';

  list(): Observable<readonly ProfessionalApplication[]> {
    return from(this.getAllApplications()).pipe(
      map((items) => items.map((item) => this.toApplication(item))),
    );
  }

  get(id: string): Observable<ProfessionalApplication> {
    return from(this.getDetails(id));
  }

  recordDecision(
    id: string,
    decision: ApplicationDecision,
    reason: string,
  ): Observable<DecisionSaveResult> {
    const apiDecision =
      decision === 'Approved'
        ? 'approved'
        : decision === 'Rejected'
          ? 'rejected'
          : 'more_info_requested';
    return from(
      this.auth
        .postAuthorized<ApiApplication>(`${this.base}/${encodeURIComponent(id)}/decision`, {
          status: apiDecision,
          reason: reason.trim(),
        })
        .then(async (saved): Promise<DecisionSaveResult> => {
          try {
            return { application: await this.getDetails(saved.id), detailsReloaded: true };
          } catch {
            return { application: this.toApplication(saved), detailsReloaded: false };
          }
        }),
    );
  }

  downloadEvidence(id: string): Promise<{ blob: Blob; fileName: string }> {
    return Promise.all([
      this.auth.getAuthorized<ApiDocument>(`documents/${encodeURIComponent(id)}`),
      this.auth.getAuthorizedBlob(`documents/${encodeURIComponent(id)}/content`),
    ]).then(([document, blob]) => ({ blob, fileName: document.original_filename }));
  }

  private async getAllApplications(): Promise<ApiApplication[]> {
    const items: ApiApplication[] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await this.auth.getAuthorized<ApiPage<ApiApplication>>(
        `${this.base}?page=${page}&page_size=100`,
      );
      if (result.items.length === 0 && items.length < result.total) {
        throw new Error('Application queue pagination is incomplete.');
      }
      items.push(...result.items);
      total = result.total;
      page += 1;
    } while (items.length < total);
    return items;
  }

  private async getDetails(id: string): Promise<ProfessionalApplication> {
    const encodedId = encodeURIComponent(id);
    const application = await this.auth.getAuthorized<ApiApplication>(`${this.base}/${encodedId}`);
    const [documents, decisions, organization] = await Promise.all([
      Promise.all(
        application.evidence_document_ids.map((documentId) =>
          this.auth.getAuthorized<ApiDocument>(`documents/${encodeURIComponent(documentId)}`),
        ),
      ),
      this.auth.getAuthorized<ApiPage<ApiDecision>>(
        `${this.base}/${encodedId}/decisions?page=1&page_size=100`,
      ),
      application.organization_id
        ? this.auth
            .getAuthorized<ApiOrganization>(
              `admin/organizations/${encodeURIComponent(application.organization_id)}`,
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      ...this.toApplication(application),
      organization:
        organization?.name ??
        application.organization_name ??
        application.workplace ??
        application.organization_id ??
        'Not specified',
      evidence: documents.map((document) => ({
        id: document.id,
        name: this.evidenceLabel(document.document_type),
        fileName: document.original_filename,
        uploadedAt: document.created_at,
      })),
      history: decisions.items.map((record) => ({
        decision: decisionLabels[record.decision],
        reviewer: record.reviewer_display_name ?? record.reviewer_user_id,
        decidedAt: record.decided_at,
        reason: record.reason,
      })),
    };
  }

  private toApplication(item: ApiApplication): ProfessionalApplication {
    return {
      id: item.id,
      userId: item.user_id,
      name: item.applicant_display_name ?? item.user_id,
      role: roleLabels[item.role],
      organization:
        item.organization_name ?? item.workplace ?? item.organization_id ?? 'Not specified',
      registration: item.registration_number ?? 'Not provided',
      status: statusLabels[item.status],
      evidence: [],
      history:
        item.reviewed_by && item.reviewed_at && item.review_reason
          ? [
              {
                decision:
                  decisionLabels[item.status as ApiDecision['decision']] ?? 'Information requested',
                reviewer: item.reviewed_by,
                decidedAt: item.reviewed_at,
                reason: item.review_reason,
              },
            ]
          : [],
    };
  }

  private evidenceLabel(documentType: string): string {
    return documentType.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
  }
}
