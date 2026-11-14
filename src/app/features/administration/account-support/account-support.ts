import { Component, computed, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import { AccountSupportApiService, SupportAccountStatus } from '../account-support-api.service';
import { HttpErrorResponse } from '@angular/common/http';

type AccountStatus = SupportAccountStatus;

interface SupportAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: AccountStatus;
}

@Component({
  selector: 'app-account-support',
  standalone: true,
  imports: [ReactiveFormsModule, UiState, A11yModule],
  templateUrl: './account-support.html',
  styleUrl: './account-support.scss',
})
export class AccountSupport {
  private readonly api = inject(AccountSupportApiService);
  readonly totalAccounts = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly searched = signal(false);
  readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(100)],
  });
  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  readonly accounts = signal<SupportAccount[]>([]);

  readonly query = signal('');
  readonly loading = signal(false);
  readonly searchError = signal('');
  readonly message = signal('');
  readonly pendingAccount = signal<SupportAccount | null>(null);
  readonly saving = signal(false);
  readonly actionError = signal('');

  readonly filteredAccounts = computed(() => this.accounts());

  async search(page = 1): Promise<void> {
    this.searchControl.markAsTouched();

    if (this.searchControl.invalid || this.loading() || this.saving()) return;

    this.loading.set(true);
    this.searchError.set('');
    this.message.set('');
    this.pendingAccount.set(null);
    this.accounts.set([]);
    this.totalAccounts.set(0);

    this.currentPage.set(page);

    if (page === 1) {
      this.query.set(this.searchControl.value.trim());
    }

    try {
      const accounts = await this.loadAccounts();
      this.accounts.set(accounts);
    } catch {
      this.searchError.set('Accounts could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadAccounts(): Promise<SupportAccount[]> {
    const result = await this.api.searchUsers(this.query(), this.currentPage());

    this.totalAccounts.set(result.total);
    this.searched.set(true);

    return result.items.map((user) => ({
      id: user.id,
      name: user.display_name,
      email: user.email ?? 'Email not provided',
      role: 'Role information is not included in this search',
      status: user.status,
    }));
  }
  statusAction(status: AccountStatus): 'suspended' | 'active' | null {
    switch (status) {
      case 'active':
        return 'suspended';
      case 'suspended':
        return 'active';
      default:
        return null;
    }
  }

  requestChange(account: SupportAccount): void {
    if (
      this.loading() ||
      this.saving() ||
      this.pendingAccount() !== null ||
      this.statusAction(account.status) === null
    ) {
      return;
    }

    this.reasonControl.reset('');
    this.actionError.set('');
    this.message.set('');
    this.pendingAccount.set(account);
  }

  cancelChange(): void {
    if (this.saving()) return;

    this.pendingAccount.set(null);
    this.reasonControl.reset('');
    this.actionError.set('');
  }

  async confirmChange(): Promise<void> {
    const account = this.pendingAccount();

    if (!account || this.saving()) return;

    this.reasonControl.markAsTouched();

    const reason = this.reasonControl.value.trim();

    if (this.reasonControl.invalid || !reason) {
      this.reasonControl.setErrors({ invalidReason: true });
      return;
    }

    if (reason.includes('\0')) {
      this.actionError.set('The reason contains an invalid character.');
      return;
    }

    const status = this.statusAction(account.status);

    if (status === null) {
      this.actionError.set(
        'Only active accounts can be suspended and suspended accounts can be reactivated. Cancel and search again.',
      );
      return;
    }

    this.saving.set(true);
    this.actionError.set('');
    this.message.set('');

    try {
      const updated = await this.api.updateStatus(account.id, status, reason);

      this.accounts.update((accounts) =>
        accounts.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.display_name,
                email: updated.email ?? 'Email not provided',
                status: updated.status,
              }
            : item,
        ),
      );

      this.pendingAccount.set(null);
      this.reasonControl.reset('');
      this.message.set(`Account status saved: ${updated.display_name} is now ${updated.status}.`);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const response = error.error;
        const backendMessage =
          response && typeof response.message === 'string' ? response.message : '';

        switch (error.status) {
          case 401:
            this.actionError.set('Your session has expired. Sign in again.');
            break;
          case 403:
            this.actionError.set(
              backendMessage || 'You do not have permission to change this account.',
            );
            break;
          case 404:
            this.actionError.set('This account is no longer available. Cancel and search again.');
            break;
          case 409:
            this.actionError.set(
              backendMessage || 'The account has changed. Cancel and search again.',
            );
            break;
          case 422:
            this.actionError.set('Check the reason and try again.');
            break;
          case 429:
            this.actionError.set('Too many requests. Wait a moment before trying again.');
            break;
          default:
            this.actionError.set(
              'The result could not be confirmed. Cancel and search again to check the account status before retrying.',
            );
        }
      } else {
        this.actionError.set(
          'The result could not be confirmed. Cancel and search again to check the account status before retrying.',
        );
      }
    } finally {
      this.saving.set(false);
    }
  }
}
