import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-help',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-help.html',
  styleUrl: './auth-help.scss',
})
export class AuthHelpComponent {
  @Input() page = '';
  @Input() role = 'Patient';
}
