import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import {
  AccountSupportApiService,
  SupportActionResult,
  SupportUser,
} from '../account-support-api.service';
import { AdminAccounts } from './admin-accounts';

describe('AdminAccounts API integration', () => {
  let component: AdminAccounts;
  let fixture: ComponentFixture<AdminAccounts>;
  let roleContext: ActiveRoleService;

  const user: SupportUser = {
    id: 'test-user-001',
    display_name: 'Sample Patient',
    email: 'patient@example.com',
    phone: null,
    status: 'active',
    is_admin: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };

  const result: SupportActionResult = {
    id: user.id,
    status: 'active',
    updated_at: '2026-11-14T00:00:00Z',
  };

  let api: {
    searchUsers: ReturnType<typeof vi.fn<AccountSupportApiService['searchUsers']>>;
    appointAdmin: ReturnType<typeof vi.fn<AccountSupportApiService['appointAdmin']>>;
    revokeAdmin: ReturnType<typeof vi.fn<AccountSupportApiService['revokeAdmin']>>;
  };

  beforeEach(async () => {
    api = {
      searchUsers: vi.fn<AccountSupportApiService['searchUsers']>(),
      appointAdmin: vi.fn<AccountSupportApiService['appointAdmin']>(),
      revokeAdmin: vi.fn<AccountSupportApiService['revokeAdmin']>(),
    };

    api.searchUsers.mockResolvedValue({
      items: [{ ...user }],
      page: 1,
      page_size: 20,
      total: 1,
    });
    api.appointAdmin.mockResolvedValue({ ...result });
    api.revokeAdmin.mockResolvedValue({ ...result, status: 'revoked' });

    await TestBed.configureTestingModule({
      imports: [AdminAccounts],
      providers: [{ provide: AccountSupportApiService, useValue: api }],
    }).compileComponents();

    roleContext = TestBed.inject(ActiveRoleService);
    roleContext.setAccountRoles('test-super-admin', ['super_admin']);

    fixture = TestBed.createComponent(AdminAccounts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows appointment only for an active non-Admin account', async () => {
    component.searchControl.setValue('  Sample  ');
    await component.search();
    fixture.detectChanges();

    expect(api.searchUsers).toHaveBeenCalledWith('Sample', 1);
    expect(fixture.nativeElement.textContent).toContain('Sample Patient');
    expect(fixture.nativeElement.textContent).toContain('No Admin assignment');

    const card: HTMLElement = fixture.nativeElement.querySelector('.account');
    expect(card.textContent).toContain('Appoint Admin');
    expect(card.textContent).not.toContain('Revoke Admin');
  });

  it('blocks delegated Admin search and hides controls', async () => {
    roleContext.setAccountRoles('test-admin', ['admin']);

    await component.search();
    fixture.detectChanges();

    expect(api.searchUsers).not.toHaveBeenCalled();
    expect(component.canManage()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Access restricted');
    expect(fixture.nativeElement.querySelectorAll('.account').length).toBe(0);
  });

  it('does not submit a role change after permission is lost', async () => {
    await component.search();

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    roleContext.setAccountRoles('test-admin', ['admin']);

    await component.confirmChange();

    expect(api.appointAdmin).not.toHaveBeenCalled();
    expect(api.revokeAdmin).not.toHaveBeenCalled();
  });

  it('does not call either action when cancelled', async () => {
    await component.search();

    component.requestChange(component.accounts()[0], 'appoint');
    component.cancelChange();
    await component.confirmChange();

    expect(component.pendingAccount()).toBeNull();
    expect(api.appointAdmin).not.toHaveBeenCalled();
    expect(api.revokeAdmin).not.toHaveBeenCalled();
  });

  it('requires a nonblank reason before appointment', async () => {
    await component.search();

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('   ');
    await component.confirmChange();

    expect(component.reasonControl.invalid).toBe(true);
    expect(api.appointAdmin).not.toHaveBeenCalled();
  });

  it('appoints only after confirmation and reloads the Admin state', async () => {
    await component.search();

    api.searchUsers.mockResolvedValue({
      items: [{ ...user, is_admin: true }],
      page: 1,
      page_size: 20,
      total: 1,
    });

    component.requestChange(component.accounts()[0], 'appoint');
    expect(api.appointAdmin).not.toHaveBeenCalled();

    component.reasonControl.setValue('  Appointment approved  ');
    await component.confirmChange();
    fixture.detectChanges();

    expect(api.appointAdmin).toHaveBeenCalledExactlyOnceWith(user.id, 'Appointment approved');
    expect(api.revokeAdmin).not.toHaveBeenCalled();
    expect(api.searchUsers).toHaveBeenCalledTimes(2);
    expect(component.accounts()[0].isAdmin).toBe(true);
    expect(component.message()).toContain('Admin appointment saved');
    expect(component.pendingAccount()).toBeNull();

    const card: HTMLElement = fixture.nativeElement.querySelector('.account');
    expect(card.textContent).toContain('Admin assigned');
    expect(card.textContent).toContain('Revoke Admin');
    expect(card.textContent).not.toContain('Appoint Admin');
  });

  it('revokes an existing Admin and reloads the assignment state', async () => {
    api.searchUsers.mockResolvedValueOnce({
      items: [{ ...user, is_admin: true }],
      page: 1,
      page_size: 20,
      total: 1,
    });

    await component.search();
    fixture.detectChanges();

    const initialCard: HTMLElement = fixture.nativeElement.querySelector('.account');
    expect(initialCard.textContent).toContain('Revoke Admin');
    expect(initialCard.textContent).not.toContain('Appoint Admin');

    component.requestChange(component.accounts()[0], 'revoke');
    component.reasonControl.setValue('Access no longer required');
    await component.confirmChange();
    fixture.detectChanges();

    expect(api.revokeAdmin).toHaveBeenCalledExactlyOnceWith(user.id, 'Access no longer required');
    expect(api.appointAdmin).not.toHaveBeenCalled();
    expect(api.searchUsers).toHaveBeenCalledTimes(2);
    expect(component.accounts()[0].isAdmin).toBe(false);
    expect(component.message()).toContain('Admin access revoked');

    const card: HTMLElement = fixture.nativeElement.querySelector('.account');
    expect(card.textContent).toContain('Appoint Admin');
    expect(card.textContent).not.toContain('Revoke Admin');
  });

  it('shows MFA denial without reporting success', async () => {
    await component.search();

    api.appointAdmin.mockRejectedValue(
      new HttpErrorResponse({
        status: 403,
        error: { message: 'Multi-factor authentication is required.' },
      }),
    );

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    await component.confirmChange();
    fixture.detectChanges();

    expect(component.message()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Multi-factor authentication is required.');
    expect(component.pendingAccount()).not.toBeNull();
    expect(component.saving()).toBe(false);
  });

  it('shows a conflicting assignment response', async () => {
    await component.search();

    api.appointAdmin.mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'The Admin role is already assigned.' },
      }),
    );

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    await component.confirmChange();

    expect(component.actionError()).toBe('The Admin role is already assigned.');
    expect(component.message()).toBe('');
  });

  it('rejects a mismatched success response', async () => {
    await component.search();
    api.appointAdmin.mockResolvedValue({ ...result, id: 'different-user' });

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    await component.confirmChange();

    expect(component.message()).toBe('');
    expect(component.actionError()).toContain('result could not be confirmed');
  });

  it('prevents duplicate appointments while saving', async () => {
    await component.search();

    let finish!: (value: SupportActionResult) => void;
    api.appointAdmin.mockImplementation(
      () => new Promise<SupportActionResult>((resolve) => (finish = resolve)),
    );

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');

    const saving = component.confirmChange();
    await component.confirmChange();

    expect(api.appointAdmin).toHaveBeenCalledOnce();
    expect(component.saving()).toBe(true);

    finish({ ...result });
    await saving;

    expect(component.saving()).toBe(false);
  });

  it('shows service failure without claiming a saved appointment', async () => {
    await component.search();
    api.appointAdmin.mockRejectedValue(new HttpErrorResponse({ status: 503 }));

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    await component.confirmChange();

    expect(component.message()).toBe('');
    expect(component.actionError()).toContain('result could not be confirmed');
  });

  it('shows search failure and can retry', async () => {
    api.searchUsers.mockRejectedValueOnce(new Error('Unavailable'));

    await component.search();

    expect(component.searchError()).not.toBe('');
    expect(component.accounts()).toEqual([]);

    await component.search();

    expect(component.searchError()).toBe('');
    expect(component.accounts()).toHaveLength(1);
  });
  it('blocks appointment of an existing Admin', async () => {
    api.searchUsers.mockResolvedValue({
      items: [{ ...user, is_admin: true }],
      page: 1,
      page_size: 20,
      total: 1,
    });

    await component.search();
    component.requestChange(component.accounts()[0], 'appoint');

    expect(component.pendingAccount()).toBeNull();
    expect(api.appointAdmin).not.toHaveBeenCalled();
  });

  it('blocks revocation of a non-Admin account', async () => {
    await component.search();
    component.requestChange(component.accounts()[0], 'revoke');

    expect(component.pendingAccount()).toBeNull();
    expect(api.revokeAdmin).not.toHaveBeenCalled();
  });

  for (const status of ['pending', 'disabled', 'suspended'] as const) {
    it(`does not offer appointment for a ${status} non-Admin account`, async () => {
      api.searchUsers.mockResolvedValue({
        items: [{ ...user, status }],
        page: 1,
        page_size: 20,
        total: 1,
      });

      await component.search();
      fixture.detectChanges();

      const card: HTMLElement = fixture.nativeElement.querySelector('.account');
      expect(card.querySelector('button')).toBeNull();

      component.requestChange(component.accounts()[0], 'appoint');

      expect(component.pendingAccount()).toBeNull();
      expect(api.appointAdmin).not.toHaveBeenCalled();
    });
  }

  it('blocks confirmation if the displayed assignment has changed', async () => {
    await component.search();

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');

    component.accounts.update((accounts) =>
      accounts.map((account) => ({ ...account, isAdmin: true })),
    );

    await component.confirmChange();

    expect(api.appointAdmin).not.toHaveBeenCalled();
    expect(api.revokeAdmin).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('role or status has changed');
  });

  it('clears stale actions when the change succeeds but refresh fails', async () => {
    await component.search();
    api.searchUsers.mockRejectedValueOnce(new Error('Refresh unavailable'));

    component.requestChange(component.accounts()[0], 'appoint');
    component.reasonControl.setValue('Appointment approved');
    await component.confirmChange();

    expect(api.appointAdmin).toHaveBeenCalledOnce();
    expect(component.message()).toContain('Admin appointment saved');
    expect(component.searchError()).toContain('could not be refreshed');
    expect(component.accounts()).toEqual([]);
    expect(component.pendingAccount()).toBeNull();
    expect(component.saving()).toBe(false);

    await component.confirmChange();
    expect(api.appointAdmin).toHaveBeenCalledOnce();
  });
});
