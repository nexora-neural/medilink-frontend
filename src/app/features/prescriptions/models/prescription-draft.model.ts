export type PrescriptionPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export type PrescriptionStatus =
  'draft' | 'active' | 'superseded' | 'completed' | 'cancelled' | 'discontinued';

export type PrescriptionLifecycleAction =
  'correct' | 'renew' | 'reissue' | 'complete' | 'cancel' | 'discontinue';

export interface PrescriptionHistoryEntry {
  id: string;
  action: PrescriptionLifecycleAction;
  reason: string;
  performedAt: string;
  performedBy: string;
  relatedPrescriptionId?: string;
}

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

  version?: number;
  previousPrescriptionId?: string;
  history?: PrescriptionHistoryEntry[];
}

export interface DoctorFavorite {
  id: string;
  ownerDoctorId: string;
  item: PrescriptionItem;
  createdAt: string;
}

export interface PrescriptionTemplate {
  id: string;
  ownerDoctorId: string;
  name: string;
  items: PrescriptionItem[];
  createdAt: string;
  updatedAt: string;
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
