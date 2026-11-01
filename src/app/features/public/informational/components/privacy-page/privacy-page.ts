import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../../../public-page-state';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPageComponent extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
