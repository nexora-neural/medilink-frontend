import { ApprovedLab, LabUploadRequest } from '../models/lab-upload-request.model';

export const SAMPLE_PATIENT_ID = 'sample-patient';

export const SAMPLE_STAFF_LAB_ID = 'sample-lab-01';

export const SAMPLE_ACTIVE_REFERENCE = 'sample_7f2c9a4e8b1d6f30';

export const SAMPLE_OTHER_LAB_REFERENCE = 'sample_3b8d1f6a9c2e7045';

export function createApprovedSampleLabs(): ApprovedLab[] {
  return [
    {
      id: SAMPLE_STAFF_LAB_ID,
      name: 'Example Central Laboratory',
    },
    {
      id: 'sample-lab-02',
      name: 'Example Community Laboratory',
    },
  ];
}

export function createSampleRequests(now = Date.now()): LabUploadRequest[] {
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'sample-request-active',
      reference: SAMPLE_ACTIVE_REFERENCE,
      patientId: SAMPLE_PATIENT_ID,
      labId: SAMPLE_STAFF_LAB_ID,
      createdAt: new Date(now - day).toISOString(),
      expiresAt: new Date(now + 6 * day).toISOString(),
      revokedAt: null,
    },
    {
      id: 'sample-request-expired',
      reference: 'sample_8e4a2c7f1b9d6035',
      patientId: SAMPLE_PATIENT_ID,
      labId: SAMPLE_STAFF_LAB_ID,
      createdAt: new Date(now - 8 * day).toISOString(),
      expiresAt: new Date(now - day).toISOString(),
      revokedAt: null,
    },
    {
      id: 'sample-request-revoked',
      reference: 'sample_2a6f9c1e7b4d8035',
      patientId: SAMPLE_PATIENT_ID,
      labId: SAMPLE_STAFF_LAB_ID,
      createdAt: new Date(now - 2 * day).toISOString(),
      expiresAt: new Date(now + 5 * day).toISOString(),
      revokedAt: new Date(now - day).toISOString(),
    },
    {
      id: 'sample-request-other-lab',
      reference: SAMPLE_OTHER_LAB_REFERENCE,
      patientId: SAMPLE_PATIENT_ID,
      labId: 'sample-lab-02',
      createdAt: new Date(now - day).toISOString(),
      expiresAt: new Date(now + 6 * day).toISOString(),
      revokedAt: null,
    },
  ];
}
