import { InjectionToken } from '@angular/core';
import { PrescriptionDraft } from '../models/prescription-draft.model';

export interface PrescriptionPdfExportRecord {
  prescription: PrescriptionDraft;
  issuerName: string;
  issuerVerificationStatus: string;
  reviewStatus: string;
}

export interface PrescriptionPdfArtifact {
  blob: Blob;
  filename: string;
  version: number;
  updatedAt: string;
}

export interface PrescriptionPdfExportPort {
  load(id: string): Promise<PrescriptionPdfExportRecord | null>;
  download(
    id: string,
    expectedVersion: number,
    expectedUpdatedAt: string,
  ): Promise<PrescriptionPdfArtifact>;
}

export const PRESCRIPTION_PDF_EXPORT = new InjectionToken<PrescriptionPdfExportPort>(
  'PrescriptionPdfExportPort',
);

export function isPrescriptionPdfExportEligible(
  prescription: PrescriptionDraft,
  doctorId: string,
): boolean {
  return (
    prescription.source === 'doctor' &&
    prescription.ownerDoctorId === doctorId &&
    ['active', 'completed', 'cancelled', 'discontinued'].includes(prescription.status)
  );
}

export function prescriptionPdfExportProblems(
  document: PrescriptionPdfExportRecord,
  doctorId: string,
): string[] {
  const problems: string[] = [];
  const prescription = document.prescription;

  if (prescription.source !== 'doctor') {
    problems.push('Only doctor-issued prescriptions can be exported.');
  }
  if (prescription.ownerDoctorId !== doctorId) {
    problems.push('Only the issuing doctor can export this sample prescription.');
  }
  if (prescription.status === 'draft') {
    problems.push('A prescription must be issued before it can be exported.');
  } else if (prescription.status === 'superseded') {
    problems.push('Only the current prescription version can be exported.');
  } else if (!['active', 'completed', 'cancelled', 'discontinued'].includes(prescription.status)) {
    problems.push('This prescription lifecycle status cannot be exported.');
  }
  if (!Number.isInteger(prescription.version ?? 1) || (prescription.version ?? 1) < 1) {
    problems.push('The prescription version is invalid. Reload the prescription and try again.');
  }
  if (!document.issuerName.trim() || !document.issuerVerificationStatus.trim()) {
    problems.push('Issuer details are incomplete.');
  }
  if (!document.reviewStatus.trim()) {
    problems.push('Review status is missing.');
  }
  if (!prescription.items.length) {
    problems.push('At least one prescription item is required.');
  }

  prescription.items.forEach((item, index) => {
    if (
      !item.medicineName.trim() ||
      !item.dose.trim() ||
      !item.route.trim() ||
      !item.frequency.trim() ||
      !Number.isInteger(item.durationDays) ||
      item.durationDays < 1 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !item.quantityUnit.trim()
    ) {
      problems.push(`Medicine ${index + 1} is incomplete and cannot be exported.`);
    }
  });

  return problems;
}
