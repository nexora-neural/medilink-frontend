import { Injectable, signal } from '@angular/core';

export type ActiveRole =
  'Patient' | 'Doctor' | 'Pharmacist' | 'Lab Staff' | 'Admin' | 'Super Admin';

@Injectable({ providedIn: 'root' })
export class ActiveRoleService {
  readonly roles: ActiveRole[] = [
    'Patient',
    'Doctor',
    'Pharmacist',
    'Lab Staff',
    'Admin',
    'Super Admin',
  ];

  // Preview state only; this is not an authenticated role.
  private readonly selectedRole = signal<ActiveRole>('Patient');

  readonly activeRole = this.selectedRole.asReadonly();

  setActiveRole(role: ActiveRole): void {
    if (this.roles.includes(role)) {
      this.selectedRole.set(role);
    }
  }
}
