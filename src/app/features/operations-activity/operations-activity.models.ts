export type ViewState = 'ready' | 'loading' | 'empty' | 'error';
export interface AuditEvent {
  id: string;
  event: string;
  actor: string;
  date: string;
  reason: string;
  privileged: boolean;
}
export interface OperationJob {
  id: string;
  name: string;
  status: 'Failed' | 'Queued';
  attempts: number;
  maxAttempts: number;
}
export interface BackupEvidence {
  id: string;
  completedAt: string;
  status: string;
  verification: string;
}
export interface PatientActivity {
  id: string;
  actor: string;
  action: string;
  scope: string;
  occurredAt: string;
}
