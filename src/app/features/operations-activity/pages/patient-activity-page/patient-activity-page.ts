import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityState } from '../../components/activity-state/activity-state';
import { PatientActivityList } from '../../components/patient-activity-list/patient-activity-list';
import { ViewState } from '../../operations-activity.models';
import { PATIENT_ACTIVITY_PREVIEW } from '../../operations-activity.preview';
@Component({
  selector: 'app-patient-activity-page',
  standalone: true,
  imports: [RouterLink, ActivityState, PatientActivityList],
  templateUrl: './patient-activity-page.html',
  styleUrl: './patient-activity-page.scss',
})
export class PatientActivityPage {
  private readonly route = inject(ActivatedRoute);
  readonly state = signal<ViewState>(this.initialState());
  readonly activities = PATIENT_ACTIVITY_PREVIEW;
  private initialState(): ViewState {
    const state = this.route.snapshot.queryParamMap.get('state');
    return state === 'loading' || state === 'empty' || state === 'error' ? state : 'ready';
  }
  reloadPreview(): void {
    this.state.set('ready');
  }
}
