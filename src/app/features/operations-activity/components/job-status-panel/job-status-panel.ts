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
  readonly busy = input(false);
  readonly retryJob = output<{ id: string; reason: string }>();
  readonly selectedId = signal<string | null>(null);
  readonly reason = signal('');
  readonly error = signal('');
  prepare(job: OperationJob): void {
    if (this.busy() || !job.retryable) return;
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
    if (this.busy() || this.selectedId() !== job.id || !job.retryable) return;
    const reason = this.reason().trim();
    if (!reason || reason.length > 1000) {
      this.error.set('Enter a reason between 1 and 1000 characters.');
      return;
    }
    this.retryJob.emit({ id: job.id, reason });
    this.cancel();
  }
}
