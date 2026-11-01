import { Injectable, signal } from '@angular/core';
export type ActiveRole = 'Patient' | 'Doctor' | 'Pharmacist' | 'Lab Staff';
@Injectable({ providedIn: 'root' })
export class ActiveRoleService {
  readonly roles: ActiveRole[] = ['Patient', 'Doctor', 'Pharmacist', 'Lab Staff'];
  readonly activeRole = signal<ActiveRole>('Patient');
  setActiveRole(role: ActiveRole): void {
    if (this.roles.includes(role)) this.activeRole.set(role);
  }
}
