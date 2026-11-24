import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-report-withdrawal-reason',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './withdrawal-reason.html',
})
export class WithdrawalReason {
  readonly reason = input('');
  readonly reasonChange = output<string>();
}
