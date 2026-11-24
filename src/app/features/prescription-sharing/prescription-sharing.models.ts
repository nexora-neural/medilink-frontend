import { InjectionToken } from '@angular/core';
export type ShareStatus = 'created' | 'claimed' | 'confirmed' | 'expired' | 'revoked';
export interface SharePrescription {
  id: string;
  label: string;
  source: 'doctor' | 'patient';
  status: 'active' | 'draft';
}
export interface PharmacyIdentity {
  pharmacistId: string;
  name: string;
  registration: string;
  organizationId: string;
  pharmacy: string;
  address: string;
}
export interface PrescriptionShare {
  id: string;
  prescriptionId: string;
  prescriptionLabel: string;
  status: ShareStatus;
  createdAt: string;
  claimExpiresAt: string;
  identity?: PharmacyIdentity;
  confirmedAt?: string;
  accessExpiresAt?: string;
}
export interface SharingData {
  prescriptions: SharePrescription[];
  shares: PrescriptionShare[];
  pharmacies: { id: string; name: string }[];
}
export interface CreatedShare {
  share: PrescriptionShare;
  claimToken: string;
}
export interface PrescriptionSharingPort {
  load(): Promise<SharingData>;
  create(prescriptionId: string): Promise<CreatedShare>;
  claim(token: string, organizationId: string): Promise<PrescriptionShare>;
  confirm(id: string): Promise<PrescriptionShare>;
  revoke(id: string, reason: string): Promise<PrescriptionShare>;
  clearSession(): void;
}
export const PRESCRIPTION_SHARING = new InjectionToken<PrescriptionSharingPort>(
  'PrescriptionSharingPort',
);
export function currentStatus(share: PrescriptionShare, now: number): ShareStatus {
  if (share.status === 'revoked' || share.status === 'expired') return share.status;
  const expiry = share.status === 'confirmed' ? share.accessExpiresAt : share.claimExpiresAt;
  return !expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now
    ? 'expired'
    : share.status;
}
export const canShare = (p: SharePrescription) => p.source === 'doctor' && p.status === 'active';
