import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import { A11yModule } from '@angular/cdk/a11y';

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
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

  readonly canManage = computed(() => this.roleContext.activeRole() === 'Super Admin');

  readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(100)],
  });

  readonly accounts = signal<AdminAccount[]>([
    {
      id: 'demo-admin-001',
      name: 'Casey Morgan',
      email: 'casey@example.com',
      isAdmin: true,
    },
    {
      id: 'demo-admin-002',
      name: 'Riley Parker',
      email: 'riley@example.com',
      isAdmin: false,
    },
    {
      id: 'demo-admin-003',
      name: 'Jamie Taylor',
      email: 'jamie@example.com',
      isAdmin: false,
    },
  ]);

  readonly query = signal('');
  readonly loading = signal(false);
  readonly searchError = signal('');
  readonly message = signal('');
  readonly pendingAccount = signal<AdminAccount | null>(null);

  readonly filteredAccounts = computed(() => {
    const query = this.query();

    return this.accounts().filter((account) =>
      `${account.id} ${account.name} ${account.email}`.toLowerCase().includes(query),
    );
  });

  async search(): Promise<void> {
    this.searchControl.markAsTouched();

    if (this.searchControl.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.searchError.set('');
    this.message.set('');
    this.pendingAccount.set(null);

    const nextQuery = this.searchControl.value.trim().toLowerCase();

    try {
      const accounts = await this.loadAccounts();

      this.accounts.set(accounts);
      this.query.set(nextQuery);
    } catch {
      this.searchError.set('Accounts could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadAccounts() {
    return this.accounts();
  }

  requestChange(account: AdminAccount): void {
    if (!this.canManage() || this.pendingAccount()) {
      return;
    }

    this.pendingAccount.set(account);
    this.message.set('');
  }

  cancelChange(): void {
    this.pendingAccount.set(null);
  }

  confirmChange(): void {
    if (!this.canManage()) {
      this.pendingAccount.set(null);
      return;
    }

    const selected = this.pendingAccount();

    if (!selected) {
      return;
    }

    const current = this.accounts().find((account) => account.id === selected.id);

    if (!current) {
      this.pendingAccount.set(null);
      return;
    }

    const nextIsAdmin = !current.isAdmin;

    this.accounts.update((accounts) =>
      accounts.map((account) =>
        account.id === current.id ? { ...account, isAdmin: nextIsAdmin } : account,
      ),
    );

    this.message.set(
      nextIsAdmin
        ? `Admin access granted to ${current.name} in this preview.`
        : `Admin access removed from ${current.name} in this preview.`,
    );

    this.pendingAccount.set(null);
  }
}
