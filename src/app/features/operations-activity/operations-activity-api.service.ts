import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import {
  ActivityResponse,
  AuditResponse,
  BackupResponse,
  JobResponse,
  OperationalSummary,
  Page,
  OperationJob,
} from './operations-activity.models';

// Mirrors the current backend HANDLERS allowlist; the server enforces every retry.
const RETRY_LIMITS: Readonly<Record<string, number>> = { 'operations.database_check': 3 };
export function mapJob(row: JobResponse): OperationJob {
  const maxAttempts = RETRY_LIMITS[row.job_type] ?? 0;
  const statuses = {
    pending: 'Queued',
    running: 'Running',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  } as const;
  return {
    id: row.id,
    name: row.job_type,
    status: statuses[row.status],
    attempts: row.attempt_count,
    maxAttempts,
    retryable: row.status === 'failed' && row.attempt_count < maxAttempts,
    errorCode: row.error_code,
  };
}
@Injectable({ providedIn: 'root' })
export class OperationsActivityApiService {
  private readonly auth = inject(AuthService);
  private pagePath(path: string, page: number): string {
    return `${path}?${new HttpParams().set('page', page).set('page_size', 20)}`;
  }
  summary(): Promise<OperationalSummary> {
    return this.auth.getAuthorized('/admin/operations');
  }
  audit(page = 1, action = ''): Promise<Page<AuditResponse>> {
    const path = this.pagePath('/admin/audit-events', page);
    return this.auth.getAuthorized(
      action.trim() ? `${path}&${new HttpParams().set('action', action.trim())}` : path,
    );
  }
  jobs(page = 1): Promise<Page<JobResponse>> {
    return this.auth.getAuthorized(this.pagePath('/admin/jobs', page));
  }
  backups(page = 1): Promise<Page<BackupResponse>> {
    return this.auth.getAuthorized(this.pagePath('/admin/backups', page));
  }
  async activity(page = 1): Promise<Page<ActivityResponse>> {
    // The backend user UUID comes from /me, never a route/query parameter or Firebase UID.
    const me = await this.auth.getOwnProfile();
    return this.auth.getAuthorized(
      this.pagePath(`/patients/${encodeURIComponent(me.user.id)}/activity`, page),
    );
  }
  retry(id: string, reason: string, key: string): Promise<JobResponse> {
    return this.auth.postAuthorizedWithKey(
      `/admin/jobs/${encodeURIComponent(id)}/retry`,
      { reason: reason.trim() },
      key,
    );
  }
}
