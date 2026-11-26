import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ActiveRoleService } from './active-role.service';

describe('ActiveRoleService', () => {
  let service: ActiveRoleService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActiveRoleService);
  });

  it('starts without an active account or available roles', () => {
    expect(service.activeAccountId()).toBeNull();
    expect(service.roles()).toEqual([]);
  });

  it('updates the active account even when both accounts have the same role', () => {
    service.setAccountRoles('patient-a', ['patient']);

    expect(service.activeAccountId()).toBe('patient-a');
    expect(service.activeRole()).toBe('Patient');

    service.setAccountRoles('patient-b', ['patient']);

    expect(service.activeAccountId()).toBe('patient-b');
    expect(service.activeRole()).toBe('Patient');
  });

  it('preserves the selected role when refreshing the same account', () => {
    service.setAccountRoles('account-a', ['patient', 'doctor']);
    service.setActiveRole('Doctor');

    service.setAccountRoles('account-a', ['patient', 'doctor']);

    expect(service.activeAccountId()).toBe('account-a');
    expect(service.activeRole()).toBe('Doctor');
  });

  it('resets the selected role when the account changes', () => {
    service.setAccountRoles('account-a', ['patient', 'doctor']);
    service.setActiveRole('Doctor');

    service.setAccountRoles('account-b', ['patient', 'doctor']);

    expect(service.activeAccountId()).toBe('account-b');
    expect(service.activeRole()).toBe('Patient');
  });

  it('does not allow selecting an unavailable role', () => {
    service.setAccountRoles('patient-a', ['patient']);

    service.setActiveRole('Lab Staff');

    expect(service.activeRole()).toBe('Patient');
  });

  it('clears the account and available roles on logout', () => {
    service.setAccountRoles('doctor-a', ['doctor']);

    service.clear();

    expect(service.activeAccountId()).toBeNull();
    expect(service.roles()).toEqual([]);
    expect(service.activeRole()).toBe('Patient');
  });

  it('restores the selected role after the service is recreated', () => {
    service.setAccountRoles('account-a', ['lab_staff', 'patient']);
    service.setActiveRole('Patient');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    const restored = TestBed.inject(ActiveRoleService);
    restored.setAccountRoles('account-a', ['lab_staff', 'patient']);

    expect(restored.activeRole()).toBe('Patient');
  });

  it('ignores a saved role that the account no longer has', () => {
    sessionStorage.setItem('medilink.active-role.account-a', 'Lab Staff');

    service.setAccountRoles('account-a', ['patient']);

    expect(service.activeRole()).toBe('Patient');
    expect(service.roles()).toEqual(['Patient']);
  });

  it('notifies subscribers synchronously when accounts change', () => {
    const accounts: (string | null)[] = [];
    const subscription = service.accountChanges$.subscribe(() => {
      accounts.push(service.activeAccountId());
    });

    try {
      service.setAccountRoles('patient-a', ['patient']);
      expect(accounts).toEqual(['patient-a']);

      service.setAccountRoles('patient-b', ['patient']);
      expect(accounts).toEqual(['patient-a', 'patient-b']);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('does not emit an account change when refreshing roles or selecting a role', () => {
    service.setAccountRoles('account-a', ['patient', 'doctor']);

    let changes = 0;
    const subscription = service.accountChanges$.subscribe(() => {
      changes++;
    });

    try {
      service.setAccountRoles('account-a', ['patient', 'doctor']);
      service.setActiveRole('Doctor');

      expect(changes).toBe(0);
      expect(service.activeRole()).toBe('Doctor');
    } finally {
      subscription.unsubscribe();
    }
  });

  it('notifies subscribers synchronously after clearing the account on logout', () => {
    service.setAccountRoles('doctor-a', ['doctor']);

    const snapshots: {
      accountId: string | null;
      roles: string[];
      activeRole: string;
    }[] = [];

    const subscription = service.accountChanges$.subscribe(() => {
      snapshots.push({
        accountId: service.activeAccountId(),
        roles: [...service.roles()],
        activeRole: service.activeRole(),
      });
    });

    try {
      service.clear();

      expect(snapshots).toEqual([
        {
          accountId: null,
          roles: [],
          activeRole: 'Patient',
        },
      ]);
    } finally {
      subscription.unsubscribe();
    }
  });
});
