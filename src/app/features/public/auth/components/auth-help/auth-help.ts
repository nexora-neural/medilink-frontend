import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../../../public-page-state';

@Component({
  selector: 'app-auth-help',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth-help.html',
  styleUrl: './auth-help.scss',
})
export class AuthHelpComponent extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
