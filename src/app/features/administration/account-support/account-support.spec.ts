import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSupportApiService, SupportUser } from '../account-support-api.service';
import { AccountSupport } from './account-support';

describe('AccountSupport API integration', () => {
  let component: AccountSupport;
  let fixture: ComponentFixture<AccountSupport>;

  const user: SupportUser = {
    id: 'test-user-001',
    display_name: 'Sample Patient',
    email: 'patient@example.com',
    phone: null,
    status: 'active',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };

  let api: {
    searchUsers: ReturnType<typeof vi.fn<AccountSupportApiService['searchUsers']>>;
    updateStatus: ReturnType<typeof vi.fn<AccountSupportApiService['updateStatus']>>;
  };

  beforeEach(async () => {
    api = {
      searchUsers: vi.fn<AccountSupportApiService['searchUsers']>(),
      updateStatus: vi.fn<AccountSupportApiService['updateStatus']>(),
    };

    api.searchUsers.mockResolvedValue({
      items: [{ ...user }],
      page: 1,
      page_size: 20,
      total: 1,
    });

    await TestBed.configureTestingModule({
      imports: [AccountSupport],
      providers: [{ provide: AccountSupportApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSupport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends a trimmed query and displays backend results', async () => {
    component.searchControl.setValue('  Sample  ');

    await component.search();
    fixture.detectChanges();

    expect(api.searchUsers).toHaveBeenCalledWith('Sample', 1);
    expect(component.totalAccounts()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Sample Patient');
    expect(fixture.nativeElement.querySelectorAll('.account-card').length).toBe(1);
  });

  it('uses the submitted query when loading another page', async () => {
    component.searchControl.setValue('Sample');
    await component.search();

    component.searchControl.setValue('Unsubmitted edit');
    await component.search(2);

    expect(api.searchUsers).toHaveBeenLastCalledWith('Sample', 2);
  });

  it('shows an empty state for an empty API response', async () => {
    api.searchUsers.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });

    await component.search();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No accounts found');
    expect(component.accounts()).toEqual([]);
  });

  it('clears stale results on search failure and can retry', async () => {
    await component.search();
    api.searchUsers.mockRejectedValueOnce(new Error('Unavailable'));

    await component.search();
    fixture.detectChanges();

    expect(component.accounts()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Unable to load accounts');

    await component.search();

    expect(component.searchError()).toBe('');
    expect(component.accounts()).toHaveLength(1);
  });

  it('does not call the API for an invalid search', async () => {
    component.searchControl.setValue('a'.repeat(101));

    await component.search();

    expect(component.searchControl.invalid).toBe(true);
    expect(api.searchUsers).not.toHaveBeenCalled();
  });

  it('does not save when confirmation is cancelled', async () => {
    await component.search();

    component.requestChange(component.accounts()[0]);
    component.cancelChange();
    await component.confirmChange();

    expect(api.updateStatus).not.toHaveBeenCalled();
    expect(component.pendingAccount()).toBeNull();
    expect(component.accounts()[0].status).toBe('active');
  });

  it('requires a nonblank reason', async () => {
    await component.search();

    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('   ');
    await component.confirmChange();

    expect(api.updateStatus).not.toHaveBeenCalled();
    expect(component.reasonControl.invalid).toBe(true);
  });

  it('suspends and reactivates using confirmed API responses', async () => {
    await component.search();

    api.updateStatus.mockResolvedValueOnce({ ...user, status: 'suspended' });
    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('  Review required  ');
    await component.confirmChange();

    expect(api.updateStatus).toHaveBeenLastCalledWith(user.id, 'suspended', 'Review required');
    expect(component.accounts()[0].status).toBe('suspended');
    expect(component.pendingAccount()).toBeNull();

    api.updateStatus.mockResolvedValueOnce({ ...user, status: 'active' });
    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Review complete');
    await component.confirmChange();

    expect(api.updateStatus).toHaveBeenLastCalledWith(user.id, 'active', 'Review complete');
    expect(component.accounts()[0].status).toBe('active');
  });

  it('shows permission denial without changing account status', async () => {
    await component.search();

    api.updateStatus.mockRejectedValue(
      new HttpErrorResponse({
        status: 403,
        error: {
          message: 'Delegated Admins cannot modify privileged accounts.',
        },
      }),
    );

    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Permission test');
    await component.confirmChange();
    fixture.detectChanges();

    expect(component.accounts()[0].status).toBe('active');
    expect(component.message()).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'Delegated Admins cannot modify privileged accounts.',
    );
    expect(component.saving()).toBe(false);
  });

  it('prevents duplicate saves while a request is pending', async () => {
    await component.search();

    let finish!: (value: SupportUser) => void;
    api.updateStatus.mockImplementation(
      () => new Promise<SupportUser>((resolve) => (finish = resolve)),
    );

    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Review required');

    const saving = component.confirmChange();
    await component.confirmChange();

    expect(component.saving()).toBe(true);
    expect(api.updateStatus).toHaveBeenCalledOnce();
    expect(component.accounts()[0].status).toBe('active');

    finish({ ...user, status: 'suspended' });
    await saving;

    expect(component.saving()).toBe(false);
    expect(component.accounts()[0].status).toBe('suspended');
  });

  it('does not show success when a save result is uncertain', async () => {
    await component.search();

    api.updateStatus.mockRejectedValue(new HttpErrorResponse({ status: 0 }));

    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Review required');
    await component.confirmChange();

    expect(component.accounts()[0].status).toBe('active');
    expect(component.message()).toBe('');
    expect(component.actionError()).toContain('result could not be confirmed');
  });
});
