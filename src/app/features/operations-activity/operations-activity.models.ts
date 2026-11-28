export type ViewState = 'ready' | 'loading' | 'empty' | 'error';
export interface AuditEvent {
  id: string;
  event: string;
  actor: string;
  date: string;
  reason: string;
  privileged: boolean;
  outcome?: string;
}
export interface OperationJob {
  id: string;
  name: string;
  status: 'Failed' | 'Queued' | 'Running' | 'Succeeded' | 'Cancelled';
  attempts: number;
  maxAttempts: number;
  retryable?: boolean;
  errorCode?: string | null;
}
export interface BackupEvidence {
  id: string;
  completedAt: string;
  status: string;
  verification: string;
  coverage?: string;
  errorCode?: string | null;
}
export interface PatientActivity {
  id: string;
  actor: string;
  action: string;
  scope: string;
  occurredAt: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}
export interface OperationalSummary {
  pending_verifications: number;
  active_organizations: number;
  failed_jobs: number;
  last_backup_at: string | null;
}
export interface JobResponse {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempt_count: number;
  error_code: string | null;
  updated_at: string;
}
export interface AuditResponse {
  id: string;
  actor_user_id: string | null;
  actor_client_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  request_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
export interface ActivityResponse {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  created_at: string;
}
export interface BackupResponse {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  database_included: boolean;
  files_included: boolean;
  started_at: string;
  finished_at: string | null;
  restore_check_status: 'not_run' | 'passed' | 'failed';
  restore_checked_at: string | null;
  error_code: string | null;
}
export function activityError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 'Please sign in again.';
  if (status === 403)
    return 'You do not have permission to view this information or perform this action.';
  if (status === 404) return 'The requested information is unavailable.';
  if (status === 409)
    return 'The job changed or cannot be retried. Refresh its status before trying again.';
  if (status === 429) return 'Too many requests. Please try again later.';
  return 'The service could not complete the request. Please try again.';
}
