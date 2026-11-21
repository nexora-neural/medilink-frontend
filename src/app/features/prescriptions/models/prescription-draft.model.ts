export type PrescriptionPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export type PrescriptionStatus = 'draft' | 'active';

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  dose: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  quantityUnit: string;
  instructions: string;
  isPrn: boolean;
}

export interface PrescriptionDraft {
  id: string;
  patientName: string;
  patientReference: string;
  ownerDoctorId: string;
  consultationId: string;
  source: 'doctor' | 'patient';
  status: PrescriptionStatus;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  updatedAt: string;
  items: PrescriptionItem[];
}

export function canEditPrescriptionDraft(
  prescription: PrescriptionDraft,
  doctorId: string,
): boolean {
  return (
    prescription.status === 'draft' &&
    prescription.source === 'doctor' &&
    prescription.ownerDoctorId === doctorId
  );
}
