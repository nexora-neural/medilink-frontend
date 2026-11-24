import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface VerificationApplication {
  id: string;
  user_id: string;
  organization_id: string | null;
  role: 'doctor' | 'pharmacist' | 'lab_staff';
  registration_number: string | null;
  status: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  evidence_document_ids: string[];
  applicant_display_name: string | null;
  organization_name: string | null;
}

export interface OperationalSummary {
  pending_verifications: number;
  active_organizations: number;
  failed_jobs: number;
  last_backup_at: string | null;
}

export interface AdminJob {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempt_count: number;
  error_code: string | null;
  updated_at: string;
}

export interface AdminAuditEvent {
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

export interface AdminBackup {
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

export interface AdminDashboardData {
  summary: OperationalSummary;
  pendingByRole: { doctor: number; pharmacist: number; lab_staff: number };
  jobs: Page<AdminJob>;
  auditEvents: Page<AdminAuditEvent>;
  backups: Page<AdminBackup>;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly auth = inject(AuthService);

  async load(): Promise<AdminDashboardData> {
    const [summary, rolePages, jobs, auditEvents, backups] = await Promise.all([
      this.auth.getAuthorized<OperationalSummary>('admin/operations'),
      Promise.all(
        (['doctor', 'pharmacist', 'lab_staff'] as const).map((role) =>
          this.auth.getAuthorized<Page<VerificationApplication>>(
            `admin/verification-applications?page=1&page_size=1&status=pending&role=${role}`,
          ),
        ),
      ),
      this.auth.getAuthorized<Page<AdminJob>>('admin/jobs?page=1&page_size=20&status=failed'),
      this.auth.getAuthorized<Page<AdminAuditEvent>>('admin/audit-events?page=1&page_size=10'),
      this.auth.getAuthorized<Page<AdminBackup>>('admin/backups?page=1&page_size=10'),
    ]);
    return {
      summary,
      pendingByRole: {
        doctor: rolePages[0].total,
        pharmacist: rolePages[1].total,
        lab_staff: rolePages[2].total,
      },
      jobs,
      auditEvents,
      backups,
    };
  }
}
