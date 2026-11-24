export type LabReportSource = 'patient' | 'laboratory';

export type LabReportStatus = 'pending' | 'accepted' | 'rejected';

export type LabReportPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export interface LabReportAttachment {
  fileName: string;
  fileType: string;
}

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

  // Legacy fields retained for existing sample reports and consumers.
  fileName: string;
  fileType: string;

  // Multiple uploaded files are represented here.
  attachments?: LabReportAttachment[];

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
  files: File[];
}

export const LAB_REPORT_STATUS_LABELS: Record<LabReportStatus, string> = {
  pending: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};
