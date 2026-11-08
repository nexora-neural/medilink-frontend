import { AboutPageComponent } from './components/about-page/about-page';
import { ContactPageComponent } from './components/contact-page/contact-page';
import { PrivacyPageComponent } from './components/privacy-page/privacy-page';
import { TermsPageComponent } from './components/terms-page/terms-page';
import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PublicPageState } from '../public-page-state';

@Component({
  selector: 'app-public-informational',
  standalone: true,
  imports: [
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
export class PublicInformational extends PublicPageState {}
