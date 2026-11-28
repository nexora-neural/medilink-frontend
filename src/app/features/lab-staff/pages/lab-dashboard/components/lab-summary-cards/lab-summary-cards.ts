import { Component, input } from '@angular/core';
import { LabDashboardSummary } from '../../models/lab-dashboard.models';

@Component({
  selector: 'app-lab-summary-cards',
  standalone: true,
  templateUrl: './lab-summary-cards.html',
  styleUrl: './lab-summary-cards.scss',
})
export class LabSummaryCards {
  readonly summary = input.required<LabDashboardSummary>();
}
