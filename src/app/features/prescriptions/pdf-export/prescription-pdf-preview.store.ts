import { Injectable } from '@angular/core';

import { SAMPLE_DOCTOR_ID } from '../data/prescription-draft.samples';
import { PrescriptionDraftPreviewStore } from '../services/prescription-draft-preview.store';
import {
  PrescriptionPdfArtifact,
  PrescriptionPdfExportPort,
  PrescriptionPdfExportRecord,
  prescriptionPdfExportProblems,
} from './prescription-pdf-export.models';

@Injectable()
export class PrescriptionPdfExportPreviewStore implements PrescriptionPdfExportPort {
  constructor(private readonly prescriptions: PrescriptionDraftPreviewStore) {}

  async load(id: string): Promise<PrescriptionPdfExportRecord | null> {
    const prescription = this.prescriptions.find(id);

    if (!prescription) return null;

    return {
      prescription,
      issuerName:
        prescription.ownerDoctorId === SAMPLE_DOCTOR_ID ? 'Dr. Maya Perera' : 'Sample doctor',
      issuerVerificationStatus:
        prescription.ownerDoctorId === SAMPLE_DOCTOR_ID
          ? 'Verified doctor · synthetic preview'
          : 'Unverified sample account',
      reviewStatus:
        prescription.status === 'draft'
          ? 'Not issued · review pending'
          : 'Issued after review · synthetic preview',
    };
  }

  async download(
    id: string,
    expectedVersion: number,
    expectedUpdatedAt: string,
  ): Promise<PrescriptionPdfArtifact> {
    const record = await this.load(id);

    if (!record) throw new Error('This prescription is no longer available.');

    const version = record.prescription.version ?? 1;

    if (version !== expectedVersion || record.prescription.updatedAt !== expectedUpdatedAt) {
      throw new Error('This prescription changed. Reload it to export the current version.');
    }

    const problems = prescriptionPdfExportProblems(record, SAMPLE_DOCTOR_ID);

    if (problems.length) throw new Error(problems[0]);

    const filename = `prescription-${safeFilename(id)}-v${version}.pdf`;

    return {
      blob: createPrescriptionPdf(record),
      filename,
      version,
      updatedAt: record.prescription.updatedAt,
    };
  }
}

export function createPrescriptionPdf(record: PrescriptionPdfExportRecord): Blob {
  const prescription = record.prescription;
  const version = prescription.version ?? 1;
  const lines = [
    'MEDILINK - DOCTOR PRESCRIPTION',
    'SYNTHETIC PREVIEW ONLY - NOT FOR CLINICAL USE',
    '',
    `Prescription ID: ${prescription.id}`,
    `Patient: ${prescription.patientName}`,
    `Patient reference: ${prescription.patientReference}`,
    `Consultation reference: ${prescription.consultationId}`,
    `Source: ${prescription.source === 'doctor' ? 'Doctor-issued' : 'Patient-added'}`,
    `Issuer: ${record.issuerName}`,
    `Issuer verification: ${record.issuerVerificationStatus}`,
    `Review status: ${record.reviewStatus}`,
    `Lifecycle status: ${prescription.status}`,
    `Current version: ${version}`,
    `Starts on: ${prescription.startsOn}`,
    `Ends on: ${prescription.endsOn}`,
    `Created at: ${prescription.createdAt}`,
    `Last updated: ${prescription.updatedAt}`,
    `Previous version: ${prescription.previousPrescriptionId ?? 'None'}`,
    '',
    'PRESCRIBED ITEMS',
  ];

  prescription.items.forEach((item, index) => {
    lines.push(
      `Medicine ${index + 1}: ${item.medicineName}`,
      `Dose: ${item.dose}`,
      `Route: ${item.route}`,
      `Frequency: ${item.frequency}`,
      `Duration: ${item.durationDays} day(s)`,
      `Quantity: ${item.quantity} ${item.quantityUnit}`,
      `As needed (PRN): ${item.isPrn ? 'Yes' : 'No'}`,
      `Instructions: ${item.instructions || 'None provided'}`,
      '',
    );
  });

  lines.push('Version history');
  if (prescription.history?.length) {
    prescription.history.forEach((entry) => {
      lines.push(
        `${entry.action} · ${entry.performedAt} · ${entry.performedBy}`,
        `Reason: ${entry.reason}`,
        `Related prescription: ${entry.relatedPrescriptionId ?? 'None'}`,
      );
    });
  } else {
    lines.push('No lifecycle changes recorded for this sample.');
  }

  return buildTextPdf(lines);
}

function safeFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'record'
  );
}

function buildTextPdf(input: string[]): Blob {
  const lines = input.flatMap(wrapLine).map(toPdfAscii);
  const linesPerPage = 48;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const pageReferences: string[] = [];
  pages.forEach((pageLines, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    pageReferences.push(`${pageObject} 0 R`);

    const commands = [
      'BT',
      '/F1 10 Tf',
      '50 790 Td',
      '14 TL',
      ...pageLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, 'T*']),
      'ET',
    ].join('\n');

    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageReferences.join(' ')}] /Count ${pages.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index++) {
    offsets[index] = new TextEncoder().encode(pdf).length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n` + `startxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function wrapLine(line: string): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const wrapped: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > 92) {
      if (current) wrapped.push(current);
      for (let index = 0; index < word.length; index += 92) {
        wrapped.push(word.slice(index, index + 92));
      }
      current = '';
      continue;
    }
    if ((current + ' ' + word).trim().length > 92) {
      wrapped.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function toPdfAscii(value: string): string {
  return value
    .replace(/[·•]/g, '-')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
