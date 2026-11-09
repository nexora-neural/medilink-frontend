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
  permissions?: string;
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
  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });
  readonly appointing = signal(false);
  readonly selectedDetails = signal<AdminAccount | null>(null);
  readonly permissionsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  readonly permissionsReasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });
  readonly confirmingPermissions = signal(false);

  readonly accounts = signal<AdminAccount[]>([
    {
      id: 'demo-admin-001',
      name: 'Casey Morgan',
      email: 'casey@example.com',
      isAdmin: true,
      permissions: 'Verification review, account support',
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

  showDetails(account: AdminAccount): void {
    if (!this.canManage() || this.pendingAccount() || this.confirmingPermissions()) return;
    if (this.selectedDetails()?.id === account.id) {
      this.selectedDetails.set(null);
      return;
    }
    this.permissionsControl.reset(account.permissions ?? '');
    this.permissionsReasonControl.reset();
    this.selectedDetails.set(account);
  }

  reviewPermissions(): void {
    if (!this.canManage() || !this.selectedDetails()?.isAdmin) return;
    this.permissionsControl.markAsTouched();
    this.permissionsReasonControl.markAsTouched();
    if (!this.permissionsControl.value.trim())
      this.permissionsControl.setErrors({ required: true });
    if (!this.permissionsReasonControl.value.trim())
      this.permissionsReasonControl.setErrors({ required: true });
    if (this.permissionsControl.invalid || this.permissionsReasonControl.invalid) return;
    this.confirmingPermissions.set(true);
  }

  savePermissions(): void {
    const selected = this.selectedDetails();
    if (
      !this.canManage() ||
      !this.confirmingPermissions() ||
      !selected ||
      !this.accounts().some((account) => account.id === selected.id && account.isAdmin)
    )
      return;
    const permissions = this.permissionsControl.value.trim();
    if (!permissions || !this.permissionsReasonControl.value.trim()) return;
    this.accounts.update((accounts) =>
      accounts.map((account) =>
        account.id === selected.id ? { ...account, permissions } : account,
      ),
    );
    this.selectedDetails.set({ ...selected, permissions });
    this.confirmingPermissions.set(false);
    this.message.set(`Permissions updated for ${selected.name} in this preview.`);
  }

  requestChange(account: AdminAccount): void {
    if (!this.canManage() || this.pendingAccount()) {
      return;
    }

    this.reasonControl.reset();
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

    this.reasonControl.markAsTouched();
    if (this.reasonControl.invalid || !this.reasonControl.value.trim()) {
      this.reasonControl.setErrors({ required: true });
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
    this.appointing.set(false);
    this.selectedDetails.set(null);
  }
}
