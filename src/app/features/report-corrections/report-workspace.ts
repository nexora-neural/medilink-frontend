import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReportCorrectionStore } from './services/report-correction.store';
@Component({
  selector: 'app-report-workspace',
  standalone: true,
  imports: [RouterOutlet],
  host: { class: 'ml128-report-workspace' },
  templateUrl: './report-workspace.html',
  styleUrls: ['./styles/report-base.scss', './styles/report-content.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReportWorkspace {
  readonly s = inject(ReportCorrectionStore);
  constructor() {
    const audience = inject(ActivatedRoute).snapshot.data['audience'];
    this.s.base = `/workspace/${audience === 'patient' ? 'patient' : 'lab-staff'}/reports`;
  }
}
