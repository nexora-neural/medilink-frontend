import { Component, input } from '@angular/core';
import { BackupEvidence } from '../../operations-activity.models';
@Component({
  selector: 'app-backup-evidence-panel',
  standalone: true,
  template: `
    <h2>Backup evidence</h2>
    @for (item of evidence(); track item.id) {
      <div class="record">
        <div>
          <strong>{{ item.id }}</strong>
          <small>{{ item.completedAt }}</small>
          <small>{{ item.verification }}</small>
          <small>{{ item.coverage }}</small>
          @if (item.errorCode) {
            <small>{{ item.errorCode }}</small>
          }
        </div>
        <span class="badge">{{ item.status }}</span>
      </div>
    } @empty {
      <p class="empty">No backup evidence available.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 19px;
      letter-spacing: -0.3px;
    }
    .record {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 17px 0;
      border-top: 1px solid #edf2f6;
    }
    strong {
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    small {
      display: block;
      margin-top: 5px;
      color: #8da0af;
      font-size: 11px;
      line-height: 1.5;
    }
    .badge {
      padding: 7px 10px;
      border-radius: 30px;
      background: #eef5fa;
      color: #56778d;
      font-size: 10px;
      font-weight: 750;
    }
    .empty {
      padding: 25px;
      color: #8195a6;
      font-size: 13px;
      text-align: center;
    }
    @media (max-width: 500px) {
      .record {
        align-items: flex-start;
        flex-wrap: wrap;
      }
    }
  `,
})
export class BackupEvidencePanel {
  readonly evidence = input.required<readonly BackupEvidence[]>();
}
