export type LabRequestStatus = 'active' | 'expired' | 'revoked';

export type LabRequestPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export interface ApprovedLab {
  id: string;
  name: string;
}

export interface LabUploadRequest {
  id: string;
  reference: string;
  patientId: string;
  labId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface ResolvedLabRequest {
  reference: string;
  patientLabel: string;
  labName: string;
  expiresAt: string;
}

export const LAB_REQUEST_STATUS_LABELS: Record<LabRequestStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function getLabRequestStatus(request: LabUploadRequest, now = Date.now()): LabRequestStatus {
  if (request.revokedAt !== null) {
    return 'revoked';
  }

  const expiresAt = Date.parse(request.expiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return 'expired';
  }

  return 'active';
}
