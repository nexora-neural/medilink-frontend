import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import { A11yModule } from '@angular/cdk/a11y';
import { AccountSupportApiService, SupportAccountStatus } from '../account-support-api.service';
import { HttpErrorResponse } from '@angular/common/http';

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  status: SupportAccountStatus;
  isAdmin: boolean | null;
}

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [ReactiveFormsModule, UiState, A11yModule],
  templateUrl: './admin-accounts.html',
  styleUrl: './admin-accounts.scss',
})
export class AdminAccounts {
  private readonly roleContext = inject(ActiveRoleService);
  private readonly api = inject(AccountSupportApiService);

  readonly currentPage = signal(1);
  readonly totalAccounts = signal(0);
  readonly pageSize = 20;
  readonly searched = signal(false);

  readonly canManage = computed(() => this.roleContext.activeRole() === 'Super Admin');

  readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(100)],
  });
  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  readonly accounts = signal<AdminAccount[]>([]);

  readonly query = signal('');
  readonly loading = signal(false);
  readonly searchError = signal('');
  readonly message = signal('');
  readonly pendingAccount = signal<AdminAccount | null>(null);
  readonly pendingAction = signal<'appoint' | 'revoke' | null>(null);
  readonly saving = signal(false);
  readonly actionError = signal('');

  readonly filteredAccounts = computed(() => this.accounts());

  async search(page = 1): Promise<void> {
    this.searchControl.markAsTouched();

    if (
      !this.canManage() ||
      this.searchControl.invalid ||
      this.loading() ||
      this.saving() ||
      this.pendingAccount()
    ) {
      return;
    }

    this.loading.set(true);
    this.searchError.set('');
    this.message.set('');

    this.accounts.set([]);
    this.totalAccounts.set(0);
    this.currentPage.set(page);

    if (page === 1) {
      this.query.set(this.searchControl.value.trim());
    }

    try {
      const accounts = await this.loadAccounts();
      this.accounts.set(accounts);
      this.searched.set(true);
    } catch {
      this.searchError.set('Accounts could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadAccounts(): Promise<AdminAccount[]> {
    const result = await this.api.searchUsers(this.query(), this.currentPage());

    this.totalAccounts.set(result.total);

    return result.items.map((user) => ({
      id: user.id,
      name: user.display_name,
      email: user.email ?? 'Email not provided',
      status: user.status,
      isAdmin: typeof user.is_admin === 'boolean' ? user.is_admin : null,
    }));
  }

  canChange(account: AdminAccount, action: 'appoint' | 'revoke'): boolean {
    return action === 'revoke'
      ? account.isAdmin === true
      : account.isAdmin === false && account.status === 'active';
  }

  requestChange(account: AdminAccount, action: 'appoint' | 'revoke' = 'appoint'): void {
    if (
      !this.canManage() ||
      this.loading() ||
      this.saving() ||
      this.pendingAccount() ||
      !this.canChange(account, action)
    ) {
      return;
    }

    this.reasonControl.reset('');
    this.actionError.set('');
    this.message.set('');
    this.pendingAction.set(action);
    this.pendingAccount.set(account);
  }

  cancelChange(): void {
    if (this.saving()) return;

    this.pendingAccount.set(null);
    this.pendingAction.set(null);
    this.reasonControl.reset('');
    this.actionError.set('');
  }

  async confirmChange(): Promise<void> {
    const account = this.pendingAccount();
    const action = this.pendingAction();

    if (!this.canManage() || !account || !action || this.saving()) return;

    const current = this.accounts().find((item) => item.id === account.id);

    if (!current || !this.canChange(current, action)) {
      this.actionError.set('The account role or status has changed. Cancel and search again.');
      return;
    }

    this.reasonControl.markAsTouched();

    const reason = this.reasonControl.value.trim();

    if (this.reasonControl.invalid || !reason) {
      this.reasonControl.setErrors({ required: true });
      return;
    }

    if (reason.includes('\0')) {
      this.actionError.set('The reason contains an invalid character.');
      return;
    }

    this.saving.set(true);
    this.actionError.set('');
    this.message.set('');

    try {
      const result =
        action === 'appoint'
          ? await this.api.appointAdmin(account.id, reason)
          : await this.api.revokeAdmin(account.id, reason);

      const expectedStatus = action === 'appoint' ? 'active' : 'revoked';

      if (result.id !== account.id || result.status !== expectedStatus) {
        this.actionError.set(
          'The result could not be confirmed. Check the account role before retrying.',
        );
        return;
      }

      this.message.set(
        action === 'appoint'
          ? `Admin appointment saved for ${account.name}.`
          : `Admin access revoked for ${account.name}.`,
      );

      this.pendingAccount.set(null);
      this.pendingAction.set(null);
      this.reasonControl.reset('');
      this.accounts.set([]);
      this.totalAccounts.set(0);

      try {
        const accounts = await this.loadAccounts();
        this.accounts.set(accounts);
      } catch {
        this.searchError.set(
          'The change was saved, but account roles could not be refreshed. Search again to see the current state.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const backendMessage =
          error.error && typeof error.error.message === 'string' ? error.error.message : '';

        switch (error.status) {
          case 401:
            this.actionError.set('Your session has expired. Sign in again.');
            break;
          case 403:
            this.actionError.set(
              backendMessage || 'Only a Super Admin signed in with MFA can perform this action.',
            );
            break;
          case 404:
            this.actionError.set('This account is no longer available.');
            break;
          case 409:
            this.actionError.set(backendMessage || 'The account is not eligible for this action.');
            break;
          case 422:
            this.actionError.set('Check the reason and try again.');
            break;
          case 429:
            this.actionError.set('Too many requests. Wait before trying again.');
            break;
          default:
            this.actionError.set(
              'The result could not be confirmed. Check the account role before retrying.',
            );
        }
      } else {
        this.actionError.set(
          'The result could not be confirmed. Check the account role before retrying.',
        );
      }
    } finally {
      this.saving.set(false);
    }
  }
}
