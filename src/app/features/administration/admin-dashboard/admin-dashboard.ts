import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { AdminDashboardData, AdminDashboardService } from './admin-dashboard.service';

type DashboardState = 'loading' | 'ready' | 'forbidden' | 'expired' | 'error';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private readonly service = inject(AdminDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<DashboardState>('loading');
  protected readonly data = signal<AdminDashboardData | null>(null);
  protected readonly reviewSummaries = computed(() => {
    const counts = this.data()?.pendingByRole;
    return [
      { role: 'Doctor', pendingCount: counts?.doctor ?? 0 },
      { role: 'Pharmacist', pendingCount: counts?.pharmacist ?? 0 },
      { role: 'Lab Staff', pendingCount: counts?.lab_staff ?? 0 },
    ];
  });
  protected readonly pendingCount = computed(() => this.data()?.summary.pending_verifications ?? 0);
  protected readonly failedJobs = computed(() => this.data()?.jobs.items ?? []);
  protected readonly auditEvents = computed(() => this.data()?.auditEvents.items ?? []);
  protected readonly backups = computed(() => this.data()?.backups.items ?? []);
  protected readonly lastBackup = computed(() => this.data()?.summary.last_backup_at ?? null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    from(this.service.load())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.data.set(result);
          this.state.set('ready');
        },
        error: (error: { status?: number; code?: string; message?: string }) => {
          this.data.set(null);
          this.state.set(
            error.status === 403
              ? 'forbidden'
              : error.status === 401 ||
                  [
                    'auth/user-token-expired',
                    'auth/id-token-expired',
                    'auth/user-disabled',
                    'auth/user-not-found',
                    'auth/invalid-user-token',
                    'TOKEN_EXPIRED',
                  ].includes(error.code ?? '') ||
                  error.message === 'Please sign in to continue.'
                ? 'expired'
                : 'error',
          );
        },
      });
  }
}
