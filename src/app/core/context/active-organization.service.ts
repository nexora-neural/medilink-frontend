import { Injectable, computed, inject, signal } from '@angular/core';
import type { MembershipResponse } from '../auth.service';
import { ActiveRole, ActiveRoleService } from './active-role.service';

const roleCodes: Record<ActiveRole, string> = {
  Patient: 'patient',
  Doctor: 'doctor',
  Pharmacist: 'pharmacist',
  'Lab Staff': 'lab_staff',
  Admin: 'admin',
  'Super Admin': 'super_admin',
};

@Injectable({ providedIn: 'root' })
export class ActiveOrganizationService {
  private readonly roleContext = inject(ActiveRoleService);
  private readonly memberships = signal<MembershipResponse[]>([]);
  private readonly selectedId = signal<string | null>(null);
  private accountId: string | null = null;

  readonly availableMemberships = computed(() => {
    const role = roleCodes[this.roleContext.activeRole()];

    return this.memberships().filter((membership) => membership.role === role);
  });

  readonly activeOrganizationId = computed(() => {
    const selected = this.selectedId();

    return this.availableMemberships().some((membership) => membership.organization_id === selected)
      ? selected
      : null;
  });

  setAccountMemberships(accountId: string, memberships: MembershipResponse[]): void {
    if (this.accountId !== accountId) {
      this.selectedId.set(null);
    }

    this.accountId = accountId;
    this.memberships.set(
      memberships.filter(
        (membership) => membership.user_id === accountId && membership.status === 'approved',
      ),
    );
  }

  selectOrganization(organizationId: string): void {
    const allowed = this.availableMemberships().some(
      (membership) => membership.organization_id === organizationId,
    );

    this.selectedId.set(allowed ? organizationId : null);
  }

  clear(): void {
    this.accountId = null;
    this.memberships.set([]);
    this.selectedId.set(null);
  }
}
