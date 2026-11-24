import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { AdminDashboardData, AdminDashboardService } from './admin-dashboard.service';

type DashboardState = 'loading' | 'ready' | 'empty' | 'forbidden' | 'expired' | 'error';

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
    const applications = this.data()?.applications.items ?? [];
    return [
      {
        role: 'Doctor',
        pendingCount: applications.filter(
          (item) => item.role === 'doctor' && item.status === 'pending',
        ).length,
      },
      {
        role: 'Pharmacist',
        pendingCount: applications.filter(
          (item) => item.role === 'pharmacist' && item.status === 'pending',
        ).length,
      },
      {
        role: 'Lab Staff',
        pendingCount: applications.filter(
          (item) => item.role === 'lab_staff' && item.status === 'pending',
        ).length,
      },
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
          const empty =
            result.applications.total === 0 &&
            result.jobs.total === 0 &&
            result.auditEvents.total === 0 &&
            result.backups.total === 0;
          this.state.set(empty ? 'empty' : 'ready');
        },
        error: (error: { status?: number }) => {
          this.data.set(null);
          this.state.set(
            error.status === 403 ? 'forbidden' : error.status === 401 ? 'expired' : 'error',
          );
        },
      });
  }
}
