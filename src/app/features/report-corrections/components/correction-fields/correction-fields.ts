import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportDraft } from '../../models/report-correction.models';
@Component({
  selector: 'app-report-correction-fields',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './correction-fields.html',
})
export class CorrectionFields {
  readonly draft = input.required<ReportDraft>();
  readonly reason = input('');
  readonly reasonChange = output<string>();
  readonly changed = output<void>();
  readonly fileSelected = output<Event>();
}
