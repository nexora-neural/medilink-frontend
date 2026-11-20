import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PreviewData } from '../super-admin-preview/preview-data';
import { DashboardStat } from './components/dashboard-stat/dashboard-stat';

type ViewState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [RouterLink, DashboardStat],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.scss',
})
export class SuperAdminDashboard {
  readonly state = signal<ViewState>('ready');
  readonly data = inject(PreviewData);
  readonly pendingCount = computed(
    () => this.data.organizations().filter((item) => item.status === 'Pending').length,
  );
  setState(state: ViewState): void {
    this.state.set(state);
  }
}
