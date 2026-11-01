import { AboutPageComponent } from './components/about-page/about-page';
import { ContactPageComponent } from './components/contact-page/contact-page';
import { PrivacyPageComponent } from './components/privacy-page/privacy-page';
import { TermsPageComponent } from './components/terms-page/terms-page';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../public-page-state';

@Component({
  selector: 'app-public-informational',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AboutPageComponent,
    ContactPageComponent,
    PrivacyPageComponent,
    TermsPageComponent,
  ],
  templateUrl: './informational.html',
  styleUrl: './informational.scss',
})
export class PublicInformational extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
