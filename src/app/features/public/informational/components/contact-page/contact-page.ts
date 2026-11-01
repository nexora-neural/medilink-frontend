import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../../../public-page-state';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.scss',
})
export class ContactPageComponent extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
