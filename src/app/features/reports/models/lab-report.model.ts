export type LabReportSource = 'patient' | 'laboratory';

export type LabReportStatus = 'pending' | 'accepted' | 'rejected';

export type LabReportPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export interface LabReport {
  id: string;
  reference: string;
  uploadRequestReference: string | null;

  patientId: string;
  patientName: string;

  labId: string;
  labName: string;

  reportType: string;
  reportDate: string;
  notes: string;

  source: LabReportSource;

  fileName: string;
  fileType: string;

  status: LabReportStatus;
  uploadedAt: string;
  reviewedAt: string | null;
}

export interface LabReportDraft {
  patientId: string;
  labId: string;
  reportType: string;
  reportDate: string;
  reference: string;
  uploadRequestReference: string | null;
  notes: string;
  source: LabReportSource;
  file: File;
}

export const LAB_REPORT_STATUS_LABELS: Record<LabReportStatus, string> = {
  pending: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};
