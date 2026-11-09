import { Component, input } from '@angular/core';
import { DoctorDashboardSummary } from '../../models/doctor-dashboard.models';

@Component({
  selector: 'app-dashboard-summary-cards',
  standalone: true,
  templateUrl: './dashboard-summary-cards.html',
  styleUrl: './dashboard-summary-cards.scss',
})
export class DashboardSummaryCards {
  readonly summary = input.required<DoctorDashboardSummary>();
  readonly loading = input(false);
}
