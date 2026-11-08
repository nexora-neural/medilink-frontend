import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPageComponent {
  @Input() page = '';
}
