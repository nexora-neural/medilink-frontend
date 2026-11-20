import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PreviewData {
  readonly organizations = signal([
    { id: 'lakeside-clinic', name: 'Lakeside Clinic', type: 'Clinic', status: 'Approved' },
    { id: 'central-laboratory', name: 'Central Laboratory', type: 'Laboratory', status: 'Pending' },
    { id: 'lakeside-pharmacy', name: 'Lakeside Pharmacy', type: 'Pharmacy', status: 'Approved' },
  ]);
  readonly integrationStatus = signal('Pending');
  readonly integrationScope = signal('Report submission');
  readonly membershipResolved = signal(false);
  readonly incidentResolved = signal(false);
  readonly reviewRequired = signal(true);
  readonly securityAlerts = signal(true);
  readonly activity = signal([
    {
      event: 'Professional application opened',
      actor: 'Nimali Perera',
      date: '2026-10-31',
      reason: 'Routine review',
      privileged: false,
    },
    {
      event: 'Integration client registered',
      actor: 'Ravi Fernando',
      date: '2026-10-31',
      reason: 'Organization request',
      privileged: true,
    },
  ]);
  log(event: string, reason: string): void {
    this.activity.update((items) => [
      {
        event,
        actor: 'Ravi Fernando',
        date: new Date().toISOString().slice(0, 10),
        reason,
        privileged: true,
      },
      ...items,
    ]);
  }
}
