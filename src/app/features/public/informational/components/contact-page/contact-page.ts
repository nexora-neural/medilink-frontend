import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.scss',
})
export class ContactPageComponent {
  @Input() page = '';
}
