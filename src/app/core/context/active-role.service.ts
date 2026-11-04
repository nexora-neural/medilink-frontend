import { Injectable, signal } from '@angular/core';
export type ActiveRole = 'Patient' | 'Doctor' | 'Pharmacist' | 'Lab Staff';
@Injectable({ providedIn: 'root' })
export class ActiveRoleService {
  readonly roles: ActiveRole[] = ['Patient', 'Doctor', 'Pharmacist', 'Lab Staff'];
  // Preview state only; this does not establish a user's authenticated role.
  private readonly selectedRole = signal<ActiveRole>('Patient');
  readonly activeRole = this.selectedRole.asReadonly();
  setActiveRole(role: ActiveRole): void {
    if (this.roles.includes(role)) this.selectedRole.set(role);
  }
}
