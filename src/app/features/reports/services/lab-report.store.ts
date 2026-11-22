import { Injectable, computed, signal } from '@angular/core';

import type { LabReport, LabReportPageState } from '../models/lab-report.model';
import { SAMPLE_LAB_REPORTS } from '../data/lab-report.samples';

@Injectable()
export class LabReportStore {
  private readonly reportData = signal<LabReport[]>([...SAMPLE_LAB_REPORTS]);

  readonly reports = this.reportData.asReadonly();

  readonly state = signal<LabReportPageState>('ready');

  readonly pendingReports = computed(() =>
    this.reportData().filter((report) => report.status === 'pending'),
  );

  readonly acceptedReports = computed(() =>
    this.reportData().filter((report) => report.status === 'accepted'),
  );

  readonly rejectedReports = computed(() =>
    this.reportData().filter((report) => report.status === 'rejected'),
  );

  readonly isEmpty = computed(() => this.reportData().length === 0);

  load(): void {
    this.state.set('loading');

    this.reportData.set([...SAMPLE_LAB_REPORTS]);

    this.state.set(this.isEmpty() ? 'empty' : 'ready');
  }

  addReport(report: LabReport): void {
    this.reportData.update((reports) => [report, ...reports]);
    this.state.set('ready');
  }

  updateReportStatus(reportId: string, status: LabReport['status']): void {
    this.reportData.update((reports) =>
      reports.map((report) =>
        report.id === reportId
          ? {
              ...report,
              status,
              reviewedAt: status === 'pending' ? null : new Date().toISOString(),
            }
          : report,
      ),
    );
  }

  setState(state: LabReportPageState): void {
    this.state.set(state);
  }
}
