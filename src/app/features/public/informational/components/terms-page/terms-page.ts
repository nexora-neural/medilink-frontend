import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../../../public-page-state';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './terms-page.html',
  styleUrl: './terms-page.scss',
})
export class TermsPageComponent extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
