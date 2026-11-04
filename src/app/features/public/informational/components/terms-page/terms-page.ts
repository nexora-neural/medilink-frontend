import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './terms-page.html',
  styleUrl: './terms-page.scss',
})
export class TermsPageComponent {
  @Input() page = '';
}
