import { Component, output } from '@angular/core';

@Component({
  selector: 'app-dashboard-status-panel',
  imports: [],
  templateUrl: './dashboard-status-panel.html',
  styleUrl: './dashboard-status-panel.scss',
})
export class DashboardStatusPanel {
  readonly retryRequested = output<void>();
}
