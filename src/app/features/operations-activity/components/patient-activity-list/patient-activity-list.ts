import { Component, input } from '@angular/core';
import { PatientActivity } from '../../operations-activity.models';
@Component({
  selector: 'app-patient-activity-list',
  standalone: true,
  templateUrl: './patient-activity-list.html',
  styleUrl: './patient-activity-list.scss',
})
export class PatientActivityList {
  readonly activities = input.required<readonly PatientActivity[]>();
}
