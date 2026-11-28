import { Component, inject, PendingTasks, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import { PatientDashboardApiService } from './patient-dashboard-api.service';

type DashboardState = 'ready' | 'loading' | 'expired' | 'denied' | 'error';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, UiState],
  templateUrl: './patient-dashboard.html',
  styleUrl: './patient-dashboard.scss',
})
export class PatientDashboard {
  private readonly api = inject(PatientDashboardApiService);
  private readonly pendingTasks = inject(PendingTasks);
  private requestId = 0;
  readonly state = signal<DashboardState>('loading');
  readonly data = signal<Awaited<ReturnType<PatientDashboardApiService['load']>> | null>(null);
  readonly todayLabel = signal('');

  constructor() {
    void this.refresh();
  }

  get responsePercent(): number {
    const data = this.data();
    return data?.medicines.length ? Math.round((data.takenCount / data.medicines.length) * 100) : 0;
  }

  async refresh(): Promise<void> {
    const finish = this.pendingTasks.add();
    const requestId = ++this.requestId;
    this.data.set(null);
    this.state.set('loading');
    const now = new Date();
    try {
      const data = await this.api.load(now);
      if (requestId !== this.requestId) return;
      this.todayLabel.set(
        new Intl.DateTimeFormat('en', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(now),
      );
      this.data.set(data);
      this.state.set('ready');
    } catch (error) {
      if (requestId !== this.requestId) return;
      const { status, code, message } = (error ?? {}) as {
        status?: number;
        code?: string;
        message?: string;
      };
      if (
        status === 401 ||
        code === 'auth/user-token-expired' ||
        message === 'Please sign in to continue.'
      ) {
        this.state.set('expired');
      } else {
        this.state.set(status === 403 ? 'denied' : 'error');
      }
    } finally {
      finish();
    }
  }

  timelinePosition(time: string): number {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return Math.min(100, Math.max(0, ((hours * 60 + Number(match[2])) / 1440) * 100));
  }

  cardBeforeMarker(time: string): boolean {
    return this.timelinePosition(time) > 70;
  }
}
