import { describe, expect, it } from 'vitest';

import { SAMPLE_DOCTOR_ID, createSamplePrescriptions } from '../data/prescription-draft.samples';
import {
  PrescriptionPdfExportPreviewStore,
  createPrescriptionPdf,
} from './prescription-pdf-preview.store';
import {
  isPrescriptionPdfExportEligible,
  prescriptionPdfExportProblems,
} from './prescription-pdf-export.models';
import { PrescriptionDraftPreviewStore } from '../services/prescription-draft-preview.store';

describe('doctor prescription PDF export preview', () => {
  it('allows only current issued records belonging to the doctor', () => {
    const prescriptions = createSamplePrescriptions();
    const active = prescriptions.find((item) => item.id === 'sample-replacement-01')!;
    const draft = prescriptions.find((item) => item.id === 'sample-draft-01')!;
    const superseded = prescriptions.find((item) => item.id === 'sample-superseded-01')!;
    const otherOwner = prescriptions.find((item) => item.id === 'sample-other-owner-01')!;

    expect(isPrescriptionPdfExportEligible(active, SAMPLE_DOCTOR_ID)).toBe(true);
    expect(isPrescriptionPdfExportEligible(draft, SAMPLE_DOCTOR_ID)).toBe(false);
    expect(isPrescriptionPdfExportEligible(superseded, SAMPLE_DOCTOR_ID)).toBe(false);
    expect(isPrescriptionPdfExportEligible(otherOwner, SAMPLE_DOCTOR_ID)).toBe(false);
  });

  it('rejects incomplete data with actionable validation errors', () => {
    const store = new PrescriptionDraftPreviewStore();
    const record = store.find('sample-replacement-01')!;
    record.items[0].dose = '';

    const problems = prescriptionPdfExportProblems(
      {
        prescription: record,
        issuerName: 'Dr. Maya Perera',
        issuerVerificationStatus: 'Verified doctor',
        reviewStatus: 'Issued',
      },
      SAMPLE_DOCTOR_ID,
    );

    expect(problems).toContain('Medicine 1 is incomplete and cannot be exported.');
  });

  it('creates a PDF containing provenance, issuer, lifecycle, version and every item field', async () => {
    const store = new PrescriptionDraftPreviewStore();
    const preview = new PrescriptionPdfExportPreviewStore(store);
    const record = await preview.load('sample-replacement-01');

    expect(record).not.toBeNull();
    const artifact = await preview.download('sample-replacement-01', 2, '2026-11-21T10:00:00Z');
    const pdf = await artifact.blob.text();

    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('(Source: Doctor-issued) Tj');
    expect(pdf).toContain('(Issuer: Dr. Maya Perera) Tj');
    expect(pdf).toContain('(Review status: Issued after review - synthetic preview) Tj');
    expect(pdf).toContain('(Lifecycle status: active) Tj');
    expect(pdf).toContain('(Current version: 2) Tj');
    expect(pdf).toContain('(Dose: Sample dose C) Tj');
    expect(pdf).toContain('(Route: Oral) Tj');
    expect(pdf).toContain('(Frequency: Sample frequency C) Tj');
    expect(pdf).toContain('(Duration: 3 day\\(s\\)) Tj');
    expect(pdf).toContain('(Quantity: 3 tablet) Tj');
    expect(pdf).toContain('(As needed \\(PRN\\): No) Tj');
    expect(pdf).toContain(
      '(Instructions: Synthetic corrected instructions for version preview.) Tj',
    );
    expect(artifact.filename).toBe('prescription-sample-replacement-01-v2.pdf');
    expect(artifact.blob.type).toBe('application/pdf');
  });

  it('rejects a stale version and an ineligible superseded version', async () => {
    const store = new PrescriptionPdfExportPreviewStore(new PrescriptionDraftPreviewStore());

    await expect(
      store.download('sample-replacement-01', 1, '2026-11-21T10:00:00Z'),
    ).rejects.toThrow('This prescription changed.');
    await expect(store.download('sample-superseded-01', 1, '2026-11-21T10:00:00Z')).rejects.toThrow(
      'Only the current prescription version can be exported.',
    );
  });

  it('creates additional PDF pages for long prescription histories and item lists', async () => {
    const prescription = createSamplePrescriptions().find(
      (item) => item.id === 'sample-replacement-01',
    )!;
    prescription.items = Array.from({ length: 12 }, (_, index) => ({
      ...prescription.items[0],
      id: `long-item-${index}`,
      instructions: 'Synthetic test instructions with enough words to wrap across lines. '.repeat(
        5,
      ),
    }));
    const blob = createPrescriptionPdf({
      prescription,
      issuerName: 'Dr. Maya Perera',
      issuerVerificationStatus: 'Verified doctor',
      reviewStatus: 'Issued',
    });
    const pdf = await blob.text();
    const pageCount = pdf.match(/\/Type \/Page \/Parent/g)?.length ?? 0;

    expect(pageCount).toBeGreaterThan(1);
    expect(pdf.endsWith('%%EOF')).toBe(true);
  });
});
