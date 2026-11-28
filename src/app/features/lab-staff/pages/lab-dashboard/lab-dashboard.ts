import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { LabSummaryCards } from './components/lab-summary-cards/lab-summary-cards';
import { LabUploadRequestsPanel } from './components/lab-upload-requests-panel/lab-upload-requests-panel';
import { LabRecentReportsPanel } from './components/lab-recent-reports-panel/lab-recent-reports-panel';
import {
  LabDashboardReport,
  LabDashboardState,
  LabDashboardSummary,
} from './models/lab-dashboard.models';

@Component({
  selector: 'app-lab-dashboard',
  standalone: true,
  imports: [RouterLink, LabSummaryCards, LabUploadRequestsPanel, LabRecentReportsPanel],
  templateUrl: './lab-dashboard.html',
  styleUrl: './lab-dashboard.scss',
})
export class LabDashboard {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  // Synthetic UI fixtures only. ML-243 supplies authorized API data.
  readonly firstName = 'Amara';
  readonly showPreview = computed(() => this.params().has('preview'));

  readonly state = computed<LabDashboardState>(() => {
    if (this.roles.activeRole() !== 'Lab Staff' || !this.roles.roles().includes('Lab Staff')) {
      return 'denied';
    }
    const value = this.params().get('preview');
    return value === 'loading' || value === 'empty' || value === 'error' || value === 'denied'
      ? value
      : 'ready';
  });

  readonly summary = computed<LabDashboardSummary>(() => ({
    openRequests: this.state() === 'empty' ? 0 : 1,
    publishedReports: this.reports().filter((report) => report.status === 'Published').length,
    laboratory: 'Central Laboratory',
    verification: 'Verified',
  }));

  readonly reports = computed<readonly LabDashboardReport[]>(() =>
    this.state() === 'ready' && this.params().get('preview') === 'reports'
      ? [
          {
            id: 'sample-report-1',
            type: 'Full blood count',
            date: '2026-11-27',
            reference: 'SAMPLE-LAB-001',
            status: 'Published',
          },
        ]
      : [],
  );
}
