import { Component, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-professional-roles',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './professional-roles.html',
  styleUrl: './professional-roles.scss',
})
export class ProfessionalRolesComponent {
  @Input() page = '';
  @Input() roles: { name: string; icon: string; description: string }[] = [];

  get professionalRoles() {
    return this.roles.filter((role) => role.name !== 'Patient');
  }
}
