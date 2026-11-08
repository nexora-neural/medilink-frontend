import {
  Component,
  ElementRef,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiState } from '../../../shared/components/ui-state/ui-state';

type AccountStatus = 'active' | 'suspended';

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
  imports: [ReactiveFormsModule, UiState],
  templateUrl: './account-support.html',
  styleUrl: './account-support.scss',
})
export class AccountSupport {
  private readonly injector = inject(Injector);
  private actionButton: HTMLButtonElement | null = null;

  @ViewChild('cancelButton')
  set cancelButton(button: ElementRef<HTMLButtonElement> | undefined) {
    if (!button) {
      return;
    }

    queueMicrotask(() => {
      if (button.nativeElement.isConnected) {
        button.nativeElement.focus();
      }
    });
  }
  readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(100)],
  });

  readonly accounts = signal<SupportAccount[]>([
    {
      id: 'demo-001',
      name: 'Alex Morgan',
      email: 'alex@example.com',
      role: 'Patient',
      status: 'active',
    },
    {
      id: 'demo-002',
      name: 'Taylor Reed',
      email: 'taylor@example.com',
      role: 'Doctor',
      status: 'suspended',
    },
    {
      id: 'demo-003',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      role: 'Pharmacist',
      status: 'active',
    },
  ]);

  readonly query = signal('');
  readonly loading = signal(false);
  readonly searchError = signal('');
  readonly message = signal('');
  readonly pendingAccount = signal<SupportAccount | null>(null);

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

  requestChange(account: SupportAccount, event?: Event): void {
    this.actionButton =
      event?.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;

    this.pendingAccount.set(account);
    this.message.set('');
  }

  cancelChange(): void {
    this.pendingAccount.set(null);
    this.restoreActionFocus();
  }

  private restoreActionFocus(): void {
    const button = this.actionButton;
    this.actionButton = null;

    afterNextRender(
      () => {
        if (button?.isConnected && !button.disabled) {
          button.focus();
        }
      },
      { injector: this.injector },
    );
  }

  confirmChange(): void {
    const selected = this.pendingAccount();

    if (!selected) {
      return;
    }

    const nextStatus: AccountStatus = selected.status === 'active' ? 'suspended' : 'active';

    this.accounts.update((accounts) =>
      accounts.map((account) =>
        account.id === selected.id ? { ...account, status: nextStatus } : account,
      ),
    );

    this.message.set(
      `${selected.name}'s demo account was ${
        nextStatus === 'active' ? 'reactivated' : 'suspended'
      }.`,
    );

    this.pendingAccount.set(null);
    this.restoreActionFocus();
  }
}
