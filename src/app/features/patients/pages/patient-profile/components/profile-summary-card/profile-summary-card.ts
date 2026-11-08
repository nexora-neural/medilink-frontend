import { Component, input } from '@angular/core';
import { PatientDetails } from '../../patient-profile';

@Component({
  selector: 'app-profile-summary-card',
  imports: [],
  templateUrl: './profile-summary-card.html',
  styleUrl: './profile-summary-card.scss',
})
export class ProfileSummaryCard {
  readonly profile = input.required<PatientDetails>();
}
