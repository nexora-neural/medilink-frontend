import { Injectable, InjectionToken } from '@angular/core';
import { IssueReview, issueProblems } from './prescription-issue.models';

export interface PrescriptionIssuePort {
  load(id: string): Promise<IssueReview | null>;
  issue(id: string): Promise<IssueReview>;
}
export const PRESCRIPTION_ISSUE = new InjectionToken<PrescriptionIssuePort>(
  'PrescriptionIssuePort',
);

export function sampleReview(): IssueReview {
  return {
    id: 'sample-order',
    patientName: 'Sample patient',
    patientReference: 'DEMO-P001',
    consultationId: 'sample-consultation',
    verifiedDoctor: true,
    ownerDoctor: true,
    consultationPermitted: true,
    prescriptionGrant: true,
    source: 'doctor',
    status: 'draft',
    startsOn: '2026-11-21',
    endsOn: '2026-11-23',
    warnings: [
      'Synthetic medication instructions for interface testing only.',
      'Allergy and interaction checks are unavailable in this preview. Review the clinical record before real issuance.',
    ],
    items: [
      {
        id: 'item-1',
        medicineName: 'Sample medicine A',
        dose: 'Sample dose A',
        route: 'Oral',
        frequency: 'Sample frequency A',
        durationDays: 3,
        quantity: 3,
        quantityUnit: 'tablet',
        instructions: 'Synthetic instructions A; not for clinical use.',
        isPrn: false,
      },
      {
        id: 'item-2',
        medicineName: 'Sample medicine B',
        dose: 'Sample dose B',
        route: 'Oral',
        frequency: 'Sample frequency B',
        durationDays: 3,
        quantity: 6,
        quantityUnit: 'capsule',
        instructions: 'Synthetic instructions B; not for clinical use.',
        isPrn: true,
      },
    ],
  };
}

@Injectable()
export class PrescriptionIssuePreviewStore implements PrescriptionIssuePort {
  private review = sampleReview();
  async load(id: string): Promise<IssueReview | null> {
    return id === this.review.id ? structuredClone(this.review) : null;
  }
  async issue(id: string): Promise<IssueReview> {
    if (id !== this.review.id || issueProblems(this.review).length)
      throw new Error('Invalid preview order');
    this.review = { ...this.review, status: 'active' };
    return structuredClone(this.review);
  }
}
