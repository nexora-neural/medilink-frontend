import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicPageState } from '../../../public-page-state';
@Component({
  selector: 'app-access-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './access-form.html',
  styleUrl: './access-form.scss',
})
export class AccessFormComponent extends PublicPageState {
  constructor(route: ActivatedRoute, router: Router) {
    super(route, router);
  }
}
