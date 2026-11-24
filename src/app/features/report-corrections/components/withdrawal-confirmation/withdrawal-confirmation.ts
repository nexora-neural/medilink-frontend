import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-report-withdrawal-confirmation',
  standalone: true,
  imports: [],
  templateUrl: './withdrawal-confirmation.html',
})
export class WithdrawalConfirmation {
  readonly reason = input('');
  readonly pending = input(false);
  readonly back = output<void>();
  readonly confirmed = output<void>();
}
