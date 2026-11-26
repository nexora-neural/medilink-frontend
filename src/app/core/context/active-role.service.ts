import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

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
  private readonly platformId = inject(PLATFORM_ID);
  private readonly availableRoles = signal<ActiveRole[]>([]);
  private readonly selectedRole = signal<ActiveRole>('Patient');
  private readonly accountId = signal<string | null>(null);
  private readonly accountChanges = new Subject<void>();

  readonly activeAccountId = this.accountId.asReadonly();
  readonly roles = this.availableRoles.asReadonly();
  readonly activeRole = this.selectedRole.asReadonly();

  // Subscribers clear account-specific state synchronously.
  readonly accountChanges$ = this.accountChanges.asObservable();

  setAccountRoles(accountId: string, codes: string[]): void {
    const roles = [
      ...new Set(
        codes.filter((code) => Object.hasOwn(roleNames, code)).map((code) => roleNames[code]),
      ),
    ];

    const accountChanged = this.accountId() !== accountId;

    this.accountId.set(accountId);
    this.availableRoles.set(roles);

    if (accountChanged || !roles.includes(this.selectedRole())) {
      const savedRole = this.readSavedRole(accountId);
      const selected = roles.find((role) => role === savedRole);

      this.selectedRole.set(selected ?? roles[0] ?? 'Patient');
    }

    this.saveRole();

    if (accountChanged) {
      this.accountChanges.next();
    }
  }

  setActiveRole(role: ActiveRole): void {
    if (!this.roles().includes(role)) return;

    this.selectedRole.set(role);
    this.saveRole();
  }

  clear(): void {
    const accountId = this.accountId();

    if (accountId && isPlatformBrowser(this.platformId)) {
      try {
        sessionStorage.removeItem(this.storageKey(accountId));
      } catch {
        // Logout must still work if browser storage is unavailable.
      }
    }

    this.accountId.set(null);
    this.availableRoles.set([]);
    this.selectedRole.set('Patient');

    this.accountChanges.next();
  }

  private storageKey(accountId: string): string {
    return `medilink.active-role.${accountId}`;
  }

  private readSavedRole(accountId: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      return sessionStorage.getItem(this.storageKey(accountId));
    } catch {
      return null;
    }
  }

  private saveRole(): void {
    const accountId = this.accountId();

    if (
      !accountId ||
      !isPlatformBrowser(this.platformId) ||
      !this.roles().includes(this.activeRole())
    ) {
      return;
    }

    try {
      sessionStorage.setItem(this.storageKey(accountId), this.activeRole());
    } catch {
      // Role selection remains usable without browser storage.
    }
  }
}
