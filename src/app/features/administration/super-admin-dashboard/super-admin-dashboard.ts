import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import { DashboardStat } from './components/dashboard-stat/dashboard-stat';
import {
  DashboardSnapshot,
  SuperAdminDashboardApiService,
} from './super-admin-dashboard-api.service';

type DashboardState =
  { kind: 'loading' | 'denied' | 'expired' | 'error' } | { kind: 'ready'; data: DashboardSnapshot };

const expiredAuthCodes = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [DatePipe, TitleCasePipe, RouterLink, DashboardStat, UiState],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.scss',
})
export class SuperAdminDashboard {
  private readonly api = inject(SuperAdminDashboardApiService);
  private readonly roles = inject(ActiveRoleService);
  private readonly refreshVersion = signal(0);
  private readonly account = computed(() =>
    this.roles.activeRole() === 'Super Admin' && this.roles.roles().includes('Super Admin')
      ? this.roles.activeAccountId()
      : null,
  );
  private readonly request = computed(() => ({
    account: this.account(),
    version: this.refreshVersion(),
  }));
  private readonly result = signal<{
    request: { account: string | null; version: number };
    state: DashboardState;
  } | null>(null);

  readonly state = computed<DashboardState>(() => {
    const request = this.request();
    if (!request.account) return { kind: 'denied' };
    const result = this.result();
    return result?.request === request ? result.state : { kind: 'loading' };
  });

  constructor() {
    effect((onCleanup) => {
      const request = this.request();
      if (!request.account) return;

      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });

      void this.api.load().then(
        (data) => {
          if (!cancelled) this.result.set({ request, state: { kind: 'ready', data } });
        },
        (error: unknown) => {
          if (!cancelled) this.result.set({ request, state: { kind: this.errorState(error) } });
        },
      );
    });
  }

  refresh(): void {
    if (this.account() && this.state().kind !== 'loading')
      this.refreshVersion.update((value) => value + 1);
  }

  private errorState(error: unknown): 'denied' | 'expired' | 'error' {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'expired';
      if (error.status === 403) return 'denied';
    }

    if (
      error instanceof Error &&
      (error.message === 'Please sign in to continue.' ||
        ('code' in error && typeof error.code === 'string' && expiredAuthCodes.has(error.code)))
    ) {
      return 'expired';
    }

    return 'error';
  }
}
