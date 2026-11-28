import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LabReport } from '../../models/report-correction.models';
import { ReportVersionLink } from '../version-link/version-link';
@Component({
  selector: 'app-report-details-card',
  standalone: true,
  imports: [RouterLink, ReportVersionLink],
  templateUrl: './details-card.html',
})
export class ReportDetailsCard {
  readonly report = input.required<LabReport>();
  readonly base = input.required<string>();
  readonly canCorrect = input(false);
  readonly canWithdraw = input(false);
  readonly correction = output<void>();
}
