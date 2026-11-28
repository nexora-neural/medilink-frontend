import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LabDashboardReport } from '../../models/lab-dashboard.models';

@Component({
  selector: 'app-lab-recent-reports-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './lab-recent-reports-panel.html',
  styleUrl: './lab-recent-reports-panel.scss',
})
export class LabRecentReportsPanel {
  readonly reports = input.required<readonly LabDashboardReport[]>();
}
