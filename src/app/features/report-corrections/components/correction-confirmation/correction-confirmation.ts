import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-report-correction-confirmation',
  standalone: true,
  imports: [],
  templateUrl: './correction-confirmation.html',
})
export class CorrectionConfirmation {
  readonly pending = input(false);
  readonly back = output<void>();
  readonly confirmed = output<void>();
}
