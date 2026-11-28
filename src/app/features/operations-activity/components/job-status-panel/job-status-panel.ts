import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationJob } from '../../operations-activity.models';
@Component({
  selector: 'app-job-status-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './job-status-panel.html',
  styleUrl: './job-status-panel.scss',
})
export class JobStatusPanel {
  readonly jobs = input.required<readonly OperationJob[]>();
  readonly retryJob = output<{ id: string; reason: string }>();
  readonly selectedId = signal<string | null>(null);
  readonly reason = signal('');
  readonly error = signal('');
  prepare(job: OperationJob): void {
    if (job.status !== 'Failed' || job.attempts >= job.maxAttempts) return;
    this.selectedId.set(job.id);
    this.reason.set('');
    this.error.set('');
  }
  cancel(): void {
    this.selectedId.set(null);
    this.reason.set('');
    this.error.set('');
  }
  confirm(job: OperationJob): void {
    if (
      this.selectedId() !== job.id ||
      job.status !== 'Failed' ||
      job.attempts >= job.maxAttempts
    ) {
      this.cancel();
      return;
    }
    const reason = this.reason().trim();
    if (!reason || reason.length > 500) {
      this.error.set('Enter a reason between 1 and 500 characters.');
      return;
    }
    this.retryJob.emit({ id: job.id, reason });
    this.cancel();
  }
}
