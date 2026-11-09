import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountSupport } from './account-support';

describe('AccountSupport', () => {
  let component: AccountSupport;
  let fixture: ComponentFixture<AccountSupport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSupport],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSupport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds an account using a name with spaces and different casing', async () => {
    component.searchControl.setValue('  ALEX  ');

    await component.search();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.account-card');

    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Alex Morgan');
  });

  it('shows an empty message when no accounts match', async () => {
    component.searchControl.setValue('zzzz');

    await component.search();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No accounts found');
    expect(fixture.nativeElement.querySelectorAll('.account-card').length).toBe(0);
  });

  it('does not change account status when cancelled', () => {
    const account = component.accounts()[0];

    component.requestChange(account);
    component.cancelChange();

    expect(component.accounts()[0].status).toBe('active');
    expect(component.pendingAccount()).toBeNull();
  });

  it('suspends and then reactivates an account after confirmation', () => {
    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Review required');
    component.confirmChange();

    expect(component.accounts()[0].status).toBe('suspended');

    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('Review complete');
    component.confirmChange();

    expect(component.accounts()[0].status).toBe('active');
  });

  it('requires a nonblank reason before changing an account status', () => {
    component.requestChange(component.accounts()[0]);
    component.reasonControl.setValue('   ');
    component.confirmChange();
    expect(component.accounts()[0].status).toBe('active');
    expect(component.reasonControl.invalid).toBe(true);
  });

  it('rejects a search longer than 100 characters', async () => {
    component.searchControl.setValue('a'.repeat(101));

    await component.search();
    fixture.detectChanges();

    expect(component.searchControl.invalid).toBe(true);
    expect(component.query()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Use no more than 100 characters.');
  });

  it('shows loading while the account request is pending', async () => {
    let finishRequest!: (accounts: ReturnType<AccountSupport['accounts']>) => void;

    const loader = vi
      .spyOn(
        component as unknown as {
          loadAccounts: () => Promise<ReturnType<AccountSupport['accounts']>>;
        },
        'loadAccounts',
      )
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finishRequest = resolve;
          }),
      );

    const search = component.search();
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Searching accounts');

    finishRequest(component.accounts());
    await search;
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('shows an error and allows a successful retry', async () => {
    const loader = vi
      .spyOn(
        component as unknown as {
          loadAccounts: () => Promise<ReturnType<AccountSupport['accounts']>>;
        },
        'loadAccounts',
      )
      .mockRejectedValueOnce(new Error('Request failed'));

    await component.search();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Unable to load accounts');

    loader.mockResolvedValue(component.accounts());

    const retryButton = fixture.nativeElement.querySelector(
      'app-ui-state button',
    ) as HTMLButtonElement;

    expect(retryButton).not.toBeNull();
    retryButton.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.searchError()).toBe('');
    expect(fixture.nativeElement.querySelector('app-ui-state')).toBeNull();
  });

  it('prevents a normal browser form submission', async () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', {
      bubbles: true,
      cancelable: true,
    });

    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    await fixture.whenStable();
  });
});
