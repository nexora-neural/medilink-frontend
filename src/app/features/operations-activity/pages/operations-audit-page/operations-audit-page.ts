import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActivityState } from '../../components/activity-state/activity-state';
import { AuditEventList } from '../../components/audit-event-list/audit-event-list';
import { BackupEvidencePanel } from '../../components/backup-evidence-panel/backup-evidence-panel';
import { JobStatusPanel } from '../../components/job-status-panel/job-status-panel';
import { ActivityPageControls } from '../../components/page-controls/page-controls';
import { OperationsActivityApiService, mapJob } from '../../operations-activity-api.service';
import {
  AuditEvent,
  BackupEvidence,
  OperationJob,
  OperationalSummary,
  ViewState,
  activityError,
} from '../../operations-activity.models';

@Component({
  selector: 'app-operations-audit-page',
  standalone: true,
  imports: [
    FormsModule,
    ActivityState,
    AuditEventList,
    BackupEvidencePanel,
    JobStatusPanel,
    ActivityPageControls,
  ],
  templateUrl: './operations-audit-page.html',
  styleUrl: './operations-audit-page.scss',
})
export class OperationsAuditPage implements OnInit {
  private readonly api = inject(OperationsActivityApiService);
  readonly privileged = inject(ActivatedRoute).snapshot.data['auditAudience'] === 'super-admin';
  readonly summary = signal<OperationalSummary | null>(null);
  readonly summaryError = signal('');
  readonly events = signal<AuditEvent[]>([]);
  readonly jobs = signal<OperationJob[]>([]);
  readonly backupEvidence = signal<BackupEvidence[]>([]);
  readonly auditState = signal<ViewState>('loading');
  readonly jobsState = signal<ViewState>('loading');
  readonly backupsState = signal<ViewState>('loading');
  readonly auditError = signal('');
  readonly jobsError = signal('');
  readonly backupsError = signal('');
  readonly auditPage = signal(1);
  readonly jobsPage = signal(1);
  readonly backupsPage = signal(1);
  readonly auditTotal = signal(0);
  readonly jobsTotal = signal(0);
  readonly backupsTotal = signal(0);
  readonly refreshing = signal(false);
  readonly retrying = signal(false);
  readonly retryNotice = signal('');
  readonly retryError = signal('');
  actionFilter = '';
  private appliedAction = '';
  private readonly retryKeys = new Map<string, { reason: string; key: string }>();
  ngOnInit(): void {
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (this.refreshing() || this.retrying()) return;
    this.refreshing.set(true);
    try {
      await Promise.all([
        this.loadSummary(),
        this.loadAudit(),
        this.loadJobs(),
        this.loadBackups(),
      ]);
    } finally {
      this.refreshing.set(false);
    }
  }
  async loadSummary(): Promise<void> {
    this.summary.set(null);
    this.summaryError.set('');
    try {
      this.summary.set(await this.api.summary());
    } catch (e) {
      this.summaryError.set(activityError(e));
    }
  }
  applyFilter(): void {
    this.appliedAction = this.actionFilter.trim();
    void this.loadAudit(1);
  }
  async loadAudit(page = this.auditPage()): Promise<void> {
    this.auditState.set('loading');
    this.events.set([]);
    this.auditError.set('');
    try {
      const result = await this.api.audit(page, this.appliedAction);
      this.events.set(
        result.items.map((row) => ({
          id: row.id,
          event: row.action,
          actor: row.actor_user_id
            ? `User ${row.actor_user_id}`
            : row.actor_client_id
              ? `Client ${row.actor_client_id}`
              : 'System',
          date: new Date(row.created_at).toLocaleString(),
          reason: `${row.target_type} · ${row.outcome} · Request ${row.request_id}`,
          privileged: false,
          outcome: row.outcome,
        })),
      );
      this.auditPage.set(result.page);
      this.auditTotal.set(result.total);
      this.auditState.set(result.items.length ? 'ready' : 'empty');
    } catch (e) {
      this.auditError.set(activityError(e));
      this.auditState.set('error');
    }
  }
  async loadJobs(page = this.jobsPage()): Promise<void> {
    this.jobsState.set('loading');
    this.jobs.set([]);
    this.jobsError.set('');
    try {
      const result = await this.api.jobs(page);
      this.jobs.set(result.items.map(mapJob));
      this.jobsPage.set(result.page);
      this.jobsTotal.set(result.total);
      this.jobsState.set(result.items.length ? 'ready' : 'empty');
    } catch (e) {
      this.jobsError.set(activityError(e));
      this.jobsState.set('error');
    }
  }
  async loadBackups(page = this.backupsPage()): Promise<void> {
    this.backupsState.set('loading');
    this.backupEvidence.set([]);
    this.backupsError.set('');
    try {
      const result = await this.api.backups(page);
      this.backupEvidence.set(
        result.items.map((row) => ({
          id: row.id,
          completedAt: row.finished_at
            ? `Finished: ${new Date(row.finished_at).toLocaleString()}`
            : `Started: ${new Date(row.started_at).toLocaleString()}`,
          status: row.status,
          verification: `Restore check: ${row.restore_check_status === 'not_run' ? 'not run' : row.restore_check_status}${row.restore_checked_at ? ' · ' + new Date(row.restore_checked_at).toLocaleString() : ''}`,
          coverage: `Database: ${row.database_included ? 'included' : 'not included'} · Files: ${row.files_included ? 'included' : 'not included'}`,
          errorCode: row.error_code,
        })),
      );
      this.backupsPage.set(result.page);
      this.backupsTotal.set(result.total);
      this.backupsState.set(result.items.length ? 'ready' : 'empty');
    } catch (e) {
      this.backupsError.set(activityError(e));
      this.backupsState.set('error');
    }
  }
  async retryJob(request: { id: string; reason: string }): Promise<void> {
    const job = this.jobs().find((row) => row.id === request.id);
    const reason = request.reason.trim();
    if (
      this.retrying() ||
      this.jobsState() !== 'ready' ||
      !job?.retryable ||
      !reason ||
      reason.length > 1000
    )
      return;
    let saved = this.retryKeys.get(job.id);
    if (!saved || saved.reason !== reason) {
      saved = { reason, key: crypto.randomUUID() };
      this.retryKeys.set(job.id, saved);
    }
    this.retrying.set(true);
    this.retryError.set('');
    this.retryNotice.set('');
    try {
      const result = await this.api.retry(job.id, reason, saved.key);
      this.jobs.update((rows) => rows.map((row) => (row.id === result.id ? mapJob(result) : row)));
      this.retryKeys.delete(job.id);
      this.retryNotice.set('Retry accepted. Refresh to check the background worker result.');
      await Promise.all([this.loadSummary(), this.loadAudit()]);
    } catch (e) {
      this.retryError.set(activityError(e));
    } finally {
      this.retrying.set(false);
    }
  }
}
