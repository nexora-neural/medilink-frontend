import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoctorActivity } from '../../models/doctor-dashboard.models';

@Component({
  selector: 'app-recent-activity-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './recent-activity-panel.html',
  styleUrl: './recent-activity-panel.scss',
})
export class RecentActivityPanel {
  readonly activities = input.required<readonly DoctorActivity[]>();
  readonly loading = input(false);
}
