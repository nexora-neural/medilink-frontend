import { Injectable, signal } from '@angular/core';

export type ActiveRole =
  'Patient' | 'Doctor' | 'Pharmacist' | 'Lab Staff' | 'Admin' | 'Super Admin';

const roleNames: Record<string, ActiveRole> = {
  patient: 'Patient',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  lab_staff: 'Lab Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

@Injectable({ providedIn: 'root' })
export class ActiveRoleService {
  private readonly availableRoles = signal<ActiveRole[]>([]);
  private readonly selectedRole = signal<ActiveRole>('Patient');
  private accountId: string | null = null;

  readonly roles = this.availableRoles.asReadonly();
  readonly activeRole = this.selectedRole.asReadonly();

  setAccountRoles(accountId: string, codes: string[]): void {
    const roles = [
      ...new Set(
        codes.filter((code) => Object.hasOwn(roleNames, code)).map((code) => roleNames[code]),
      ),
    ];

    const accountChanged = this.accountId !== accountId;

    this.accountId = accountId;
    this.availableRoles.set(roles);

    if (accountChanged || !roles.includes(this.selectedRole())) {
      this.selectedRole.set(roles[0] ?? 'Patient');
    }
  }

  setActiveRole(role: ActiveRole): void {
    if (this.roles().includes(role)) {
      this.selectedRole.set(role);
    }
  }

  clear(): void {
    this.accountId = null;
    this.availableRoles.set([]);
    this.selectedRole.set('Patient');
  }
}
