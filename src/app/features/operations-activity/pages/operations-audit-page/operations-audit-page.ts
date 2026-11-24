import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ActivityState } from '../../components/activity-state/activity-state';
import { AuditEventList } from '../../components/audit-event-list/audit-event-list';
import { ViewState } from '../../operations-activity.models';
import { AUDIT_PREVIEW } from '../../operations-activity.preview';

@Component({
  selector: 'app-operations-audit-page',
  standalone: true,
  imports: [ActivityState, AuditEventList],
  templateUrl: './operations-audit-page.html',
  styleUrl: './operations-audit-page.scss',
})
export class OperationsAuditPage {
  private readonly route = inject(ActivatedRoute);

  readonly privileged = this.route.snapshot.data['auditAudience'] === 'super-admin';

  readonly state = signal<ViewState>(this.initialState());

  readonly visibleEvents = computed(() =>
    this.state() === 'empty'
      ? []
      : AUDIT_PREVIEW.filter((event) => this.privileged || !event.privileged),
  );

  private initialState(): ViewState {
    const state = this.route.snapshot.queryParamMap.get('state');

    return state === 'loading' || state === 'empty' || state === 'error' ? state : 'ready';
  }

  reloadPreview(): void {
    this.state.set('ready');
  }
}
