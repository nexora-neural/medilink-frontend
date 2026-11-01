import { AuthIntroComponent } from './components/auth-intro/auth-intro';
import { AccessFormComponent } from './components/access-form/access-form';
import { ProfessionalRolesComponent } from './components/professional-roles/professional-roles';
import { RegistrationComponent } from './components/registration/registration';
import { AuthHelpComponent } from './components/auth-help/auth-help';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../public-page-state';

@Component({
  selector: 'app-public-auth',
  standalone: true,
  imports: [
    AuthIntroComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    ProfessionalRolesComponent,
    RegistrationComponent,
    AuthHelpComponent,
    AccessFormComponent,
  ],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class PublicAuth extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
