import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ActiveRoleService } from '../../../core/context/active-role.service';
import { AdminAccounts } from './admin-accounts';

describe('AdminAccounts', () => {
  let component: AdminAccounts;
  let fixture: ComponentFixture<AdminAccounts>;
  let roleContext: ActiveRoleService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAccounts],
    }).compileComponents();

    roleContext = TestBed.inject(ActiveRoleService);
    roleContext.setActiveRole('Super Admin');

    fixture = TestBed.createComponent(AdminAccounts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows account controls for Super Admin', () => {
    expect(component.canManage()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Grant access');
  });

  it('hides account controls from delegated Admin', () => {
    roleContext.setActiveRole('Admin');
    fixture.detectChanges();

    expect(component.canManage()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Access restricted');
    expect(fixture.nativeElement.querySelectorAll('.account').length).toBe(0);
  });

  it('prevents delegated Admin from requesting a role change', () => {
    roleContext.setActiveRole('Admin');

    component.requestChange(component.accounts()[1]);

    expect(component.pendingAccount()).toBeNull();
    expect(component.accounts()[1].isAdmin).toBe(false);
  });

  it('blocks confirmation if Super Admin permission is lost', () => {
    component.requestChange(component.accounts()[1]);

    roleContext.setActiveRole('Admin');
    component.confirmChange();

    expect(component.accounts()[1].isAdmin).toBe(false);
    expect(component.pendingAccount()).toBeNull();
  });

  it('does not grant access when cancelled', () => {
    component.requestChange(component.accounts()[1]);
    component.cancelChange();

    expect(component.accounts()[1].isAdmin).toBe(false);
    expect(component.pendingAccount()).toBeNull();
  });

  it('grants and removes Admin access after confirmation', () => {
    component.requestChange(component.accounts()[1]);
    component.reasonControl.setValue('Appointment approved');
    component.confirmChange();

    expect(component.accounts()[1].isAdmin).toBe(true);

    component.requestChange(component.accounts()[1]);
    component.reasonControl.setValue('Access no longer required');
    component.confirmChange();

    expect(component.accounts()[1].isAdmin).toBe(false);
  });

  it('requires a nonblank reason before changing Admin access', () => {
    component.requestChange(component.accounts()[1]);
    component.reasonControl.setValue('   ');
    component.confirmChange();
    expect(component.accounts()[1].isAdmin).toBe(false);
    expect(component.reasonControl.invalid).toBe(true);
  });

  it('requires a reason and confirmation before saving preview permissions', () => {
    component.showDetails(component.accounts()[0]);
    component.permissionsControl.setValue('Account support');
    component.reviewPermissions();
    expect(component.confirmingPermissions()).toBe(false);
    expect(component.accounts()[0].permissions).toBe('Verification review, account support');
    component.permissionsReasonControl.setValue('Role review');
    component.reviewPermissions();
    expect(component.confirmingPermissions()).toBe(true);
    component.savePermissions();
    expect(component.accounts()[0].permissions).toBe('Account support');
  });

  it('does not save permissions after Super Admin role is lost', () => {
    component.showDetails(component.accounts()[0]);
    component.permissionsControl.setValue('Account support');
    component.permissionsReasonControl.setValue('Role review');
    component.reviewPermissions();
    roleContext.setActiveRole('Admin');
    component.savePermissions();
    expect(component.accounts()[0].permissions).toBe('Verification review, account support');
  });

  it('finds accounts using a case-insensitive search', async () => {
    component.searchControl.setValue('  RILEY  ');

    await component.search();
    fixture.detectChanges();

    const accounts = fixture.nativeElement.querySelectorAll('.account');

    expect(accounts.length).toBe(1);
    expect(accounts[0].textContent).toContain('Riley Parker');
  });

  it('shows an empty message when no accounts match', async () => {
    component.searchControl.setValue('zzzz');

    await component.search();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No accounts found');
  });
});
