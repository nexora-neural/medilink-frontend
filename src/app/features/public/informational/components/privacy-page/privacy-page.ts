import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPageComponent {
  @Input() page = '';
}
