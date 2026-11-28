import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ActivityState } from '../../components/activity-state/activity-state';
import { AuditEventList } from '../../components/audit-event-list/audit-event-list';
import { ViewState } from '../../operations-activity.models';
import { AUDIT_PREVIEW, BACKUP_PREVIEW, JOB_PREVIEW } from '../../operations-activity.preview';
import { BackupEvidencePanel } from '../../components/backup-evidence-panel/backup-evidence-panel';
import { JobStatusPanel } from '../../components/job-status-panel/job-status-panel';
import { OperationJob } from '../../operations-activity.models';

@Component({
  selector: 'app-operations-audit-page',
  standalone: true,
  imports: [ActivityState, AuditEventList, BackupEvidencePanel, JobStatusPanel],
  templateUrl: './operations-audit-page.html',
  styleUrl: './operations-audit-page.scss',
})
export class OperationsAuditPage {
  private readonly route = inject(ActivatedRoute);

  readonly privileged = this.route.snapshot.data['auditAudience'] === 'super-admin';

  readonly state = signal<ViewState>(this.initialState());

  readonly visibleEvents = computed(() =>
    this.state() === 'empty'
      ? []
      : AUDIT_PREVIEW.filter((event) => this.privileged || !event.privileged),
  );

  readonly backupEvidence = BACKUP_PREVIEW;
  readonly jobs = signal<readonly OperationJob[]>(JOB_PREVIEW.map((job) => ({ ...job })));
  readonly retryNotice = signal('');

  retryPreviewJob(request: { id: string; reason: string }): void {
    if (!this.privileged || this.state() !== 'ready') return;

    const reason = request.reason.trim();
    if (!reason || reason.length > 500) return;

    const job = this.jobs().find((item) => item.id === request.id);
    if (!job || job.status !== 'Failed' || job.attempts >= job.maxAttempts) return;

    this.jobs.update((items) =>
      items.map((item) =>
        item.id === request.id ? { ...item, status: 'Queued', attempts: item.attempts + 1 } : item,
      ),
    );

    this.retryNotice.set('Retry queued in the sample preview.');
  }

  private initialState(): ViewState {
    const state = this.route.snapshot.queryParamMap.get('state');

    return state === 'loading' || state === 'empty' || state === 'error' ? state : 'ready';
  }

  reloadPreview(): void {
    this.state.set('ready');
  }
}
