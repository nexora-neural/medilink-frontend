export interface ReportDraft {
  type: string;
  date: string;
  reference: string;
  notes: string;
  file: string;
  url: string;
  mime: string;
}
export interface LabReport extends ReportDraft {
  id: string;
  patient: string;
  request: string;
  status: 'Published' | 'Superseded' | 'Withdrawn';
  version: number;
  reason?: string;
  previous?: string;
}
// ML-143 supplies these capabilities from trusted identity, source and original-lab checks.
// An expired original upload request must not disable an otherwise permitted correction.
export interface ReportPermissions {
  correct: boolean;
  withdraw: boolean;
}
