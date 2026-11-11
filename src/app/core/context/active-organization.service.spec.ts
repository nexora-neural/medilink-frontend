import { TestBed } from '@angular/core/testing';
import type { MembershipResponse } from '../auth.service';
import { ActiveOrganizationService } from './active-organization.service';
import { ActiveRoleService } from './active-role.service';

describe('ActiveOrganizationService', () => {
  let service: ActiveOrganizationService;
  let roles: ActiveRoleService;

  function membership(changes: Partial<MembershipResponse> = {}): MembershipResponse {
    return {
      id: 'membership-1',
      organization_id: 'organization-1',
      user_id: 'account-1',
      role: 'doctor',
      status: 'active',
      verified_at: null,
      created_at: '2026-01-01T00:00:00Z',
      ...changes,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    roles = TestBed.inject(ActiveRoleService);
    service = TestBed.inject(ActiveOrganizationService);

    roles.setAccountRoles('account-1', ['doctor', 'pharmacist']);
  });

  it('includes only active memberships owned by the account and matching its role', () => {
    service.setAccountMemberships('account-1', [
      membership(),
      membership({ id: 'pending', status: 'pending' }),
      membership({ id: 'other-account', user_id: 'account-2' }),
      membership({ id: 'other-role', role: 'pharmacist' }),
    ]);

    expect(service.availableMemberships().map((item) => item.id)).toEqual(['membership-1']);
  });

  it('selects an available organization and rejects an unknown organization', () => {
    service.setAccountMemberships('account-1', [membership()]);

    service.selectOrganization('organization-1');
    expect(service.activeOrganizationId()).toBe('organization-1');

    service.selectOrganization('unknown');
    expect(service.activeOrganizationId()).toBeNull();
  });

  it('does not expose a selection that does not match the active role', () => {
    service.setAccountMemberships('account-1', [membership()]);
    service.selectOrganization('organization-1');

    roles.setActiveRole('Pharmacist');

    expect(service.availableMemberships()).toEqual([]);
    expect(service.activeOrganizationId()).toBeNull();
  });

  it('clears the selection when the account changes', () => {
    service.setAccountMemberships('account-1', [membership()]);
    service.selectOrganization('organization-1');

    roles.setAccountRoles('account-2', ['doctor']);
    service.setAccountMemberships('account-2', [membership({ user_id: 'account-2' })]);

    expect(service.activeOrganizationId()).toBeNull();
  });

  it('invalidates a selection when its membership becomes inactive', () => {
    service.setAccountMemberships('account-1', [membership()]);
    service.selectOrganization('organization-1');

    service.setAccountMemberships('account-1', [membership({ status: 'suspended' })]);

    expect(service.availableMemberships()).toEqual([]);
    expect(service.activeOrganizationId()).toBeNull();
  });

  it('clears memberships and selection when the session is cleared', () => {
    service.setAccountMemberships('account-1', [membership()]);
    service.selectOrganization('organization-1');

    service.clear();

    expect(service.availableMemberships()).toEqual([]);
    expect(service.activeOrganizationId()).toBeNull();
  });
});
