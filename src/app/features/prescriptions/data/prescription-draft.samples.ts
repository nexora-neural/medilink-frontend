import { PrescriptionDraft } from '../models/prescription-draft.model';

export const SAMPLE_DOCTOR_ID = 'sample-doctor-01';

export function createSamplePrescriptions(): PrescriptionDraft[] {
  const prescriptions: PrescriptionDraft[] = [
    {
      id: 'sample-draft-01',
      patientName: 'Sample patient A',
      patientReference: 'DEMO-P001',
      ownerDoctorId: SAMPLE_DOCTOR_ID,
      consultationId: 'sample-consultation-01',
      source: 'doctor',
      status: 'draft',
      startsOn: '2026-11-21',
      endsOn: '2026-11-23',
      createdAt: '2026-11-21T08:00:00Z',
      updatedAt: '2026-11-21T08:00:00Z',
      items: [
        {
          id: 'sample-item-01',
          medicineName: 'Sample medicine A',
          dose: 'Sample dose A',
          route: 'Oral',
          frequency: 'Sample frequency A',
          durationDays: 3,
          quantity: 3,
          quantityUnit: 'tablet',
          instructions: 'Synthetic instructions for interface testing only.',
          isPrn: false,
        },
        {
          id: 'sample-item-02',
          medicineName: 'Sample medicine B',
          dose: 'Sample dose B',
          route: 'Oral',
          frequency: 'Sample frequency B',
          durationDays: 3,
          quantity: 6,
          quantityUnit: 'capsule',
          instructions: 'Synthetic instructions for interface testing only.',
          isPrn: true,
        },
      ],
    },
    {
      id: 'sample-active-01',
      patientName: 'Sample patient B',
      patientReference: 'DEMO-P002',
      ownerDoctorId: SAMPLE_DOCTOR_ID,
      consultationId: 'sample-consultation-02',
      source: 'doctor',
      status: 'active',
      startsOn: '2026-11-20',
      endsOn: '2026-11-22',
      createdAt: '2026-11-20T08:00:00Z',
      updatedAt: '2026-11-20T09:00:00Z',
      items: [
        {
          id: 'sample-item-03',
          medicineName: 'Sample medicine C',
          dose: 'Sample dose C',
          route: 'Oral',
          frequency: 'Sample frequency C',
          durationDays: 3,
          quantity: 3,
          quantityUnit: 'tablet',
          instructions: 'Synthetic instructions for interface testing only.',
          isPrn: false,
        },
      ],
    },
    {
      id: 'sample-other-owner-01',
      patientName: 'Sample patient C',
      patientReference: 'DEMO-P003',
      ownerDoctorId: 'sample-doctor-02',
      consultationId: 'sample-consultation-03',
      source: 'doctor',
      status: 'draft',
      startsOn: '2026-11-21',
      endsOn: '2026-11-23',
      createdAt: '2026-11-21T07:00:00Z',
      updatedAt: '2026-11-21T07:00:00Z',
      items: [
        {
          id: 'sample-item-04',
          medicineName: 'Sample medicine D',
          dose: 'Sample dose D',
          route: 'Oral',
          frequency: 'Sample frequency D',
          durationDays: 3,
          quantity: 3,
          quantityUnit: 'tablet',
          instructions: 'Synthetic instructions for interface testing only.',
          isPrn: false,
        },
      ],
    },
  ];

  return prescriptions;
}
