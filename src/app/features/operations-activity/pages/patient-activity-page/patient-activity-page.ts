import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivityState } from '../../components/activity-state/activity-state';
import { PatientActivityList } from '../../components/patient-activity-list/patient-activity-list';
import { ActivityPageControls } from '../../components/page-controls/page-controls';
import { OperationsActivityApiService } from '../../operations-activity-api.service';
import { PatientActivity, ViewState, activityError } from '../../operations-activity.models';
@Component({
  selector: 'app-patient-activity-page',
  standalone: true,
  imports: [RouterLink, ActivityState, PatientActivityList, ActivityPageControls],
  templateUrl: './patient-activity-page.html',
  styleUrl: './patient-activity-page.scss',
})
export class PatientActivityPage implements OnInit {
  private readonly api = inject(OperationsActivityApiService);
  readonly state = signal<ViewState>('loading');
  readonly activities = signal<PatientActivity[]>([]);
  readonly error = signal('');
  readonly page = signal(1);
  readonly total = signal(0);
  ngOnInit(): void {
    void this.load();
  }
  async load(page = this.page()): Promise<void> {
    this.state.set('loading');
    this.activities.set([]);
    this.error.set('');
    try {
      const result = await this.api.activity(page);
      this.activities.set(
        result.items.map((row) => ({
          id: row.id,
          actor: '',
          action: row.action,
          scope: `${row.target_type} · ${row.outcome}`,
          occurredAt: new Date(row.created_at).toLocaleString(),
        })),
      );
      this.page.set(result.page);
      this.total.set(result.total);
      this.state.set(result.items.length ? 'ready' : 'empty');
    } catch (e) {
      this.error.set(activityError(e));
      this.state.set('error');
    }
  }
}
