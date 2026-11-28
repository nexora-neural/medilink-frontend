import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-report-version-link',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './version-link.html',
})
export class ReportVersionLink {
  readonly previous = input.required<string>();
  readonly base = input.required<string>();
}
