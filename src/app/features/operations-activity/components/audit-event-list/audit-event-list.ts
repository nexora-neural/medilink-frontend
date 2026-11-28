import { Component, input } from '@angular/core';
import { AuditEvent } from '../../operations-activity.models';
@Component({
  selector: 'app-audit-event-list',
  standalone: true,
  templateUrl: './audit-event-list.html',
  styleUrl: './audit-event-list.scss',
})
export class AuditEventList {
  readonly events = input.required<readonly AuditEvent[]>();
}
