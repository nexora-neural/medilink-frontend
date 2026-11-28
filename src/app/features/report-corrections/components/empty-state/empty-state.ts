import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-report-empty-state',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './empty-state.html',
})
export class ReportEmptyState {
  readonly title = input('Select an active report first');
  readonly base = input.required<string>();
}
