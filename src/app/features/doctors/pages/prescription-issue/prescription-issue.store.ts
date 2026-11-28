import { Injectable, InjectionToken } from '@angular/core';
import { SAMPLE_DOCTOR_ID } from '../../../prescriptions/data/prescription-draft.samples';
import { PrescriptionDraftPreviewStore } from '../../../prescriptions/services/prescription-draft-preview.store';
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

  constructor(private readonly drafts: PrescriptionDraftPreviewStore) {}

  async load(id: string): Promise<IssueReview | null> {
    const draft = this.drafts.find(id);
    if (draft) {
      return {
        id: draft.id,
        patientName: draft.patientName,
        patientReference: draft.patientReference,
        consultationId: draft.consultationId,
        verifiedDoctor: true,
        ownerDoctor: draft.ownerDoctorId === SAMPLE_DOCTOR_ID && draft.source === 'doctor',
        consultationPermitted: true,
        prescriptionGrant: true,
        source: draft.source,
        status: draft.status,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        warnings: [
          'Synthetic preview checks only. This screen does not clinically verify the doctor, patient, medicines, allergies, interactions or access permissions.',
          'Confirm this sample action only to see the local preview state change. No clinical order will be issued.',
        ],
        items: structuredClone(draft.items),
      };
    }
    return id === this.review.id ? structuredClone(this.review) : null;
  }
  async issue(id: string): Promise<IssueReview> {
    if (this.drafts.find(id)) {
      const updated = this.drafts.issuePreviewDraft(id);
      const review = await this.load(updated.id);
      if (!review) throw new Error('Sample draft is unavailable.');
      return review;
    }
    if (id !== this.review.id) throw new Error('Invalid preview order');
    if (this.review.status === 'active') return structuredClone(this.review);
    if (issueProblems(this.review).length) throw new Error('Invalid preview order');
    this.review = { ...this.review, status: 'active' };
    return structuredClone(this.review);
  }
}
