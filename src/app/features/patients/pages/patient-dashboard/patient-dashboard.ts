import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiState } from '../../../../shared/components/ui-state/ui-state';

type DashboardState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, UiState],
  templateUrl: './patient-dashboard.html',
  styleUrl: './patient-dashboard.scss',
})
export class PatientDashboard {
  private readonly route = inject(ActivatedRoute);
  readonly state = signal<DashboardState>('ready');
  readonly showPreviewTools = signal(false);

  // Synthetic display content only. ML-240 owns authorized patient API data.
  readonly medicines = [
    { name: 'Amlodipine', dose: '5 mg · 1 tablet', time: '8:00 AM', source: 'Doctor-issued' },
    {
      name: 'Metformin',
      dose: '500 mg · 1 tablet',
      time: '8:00 PM',
      source: 'Patient-added · Not clinically verified',
    },
    { name: 'Atorvastatin', dose: '20 mg · 1 tablet', time: '9:00 PM', source: 'Doctor-issued' },
    {
      name: 'Vitamin D',
      dose: '1000 IU · 1 capsule',
      time: '9:00 AM',
      source: 'Patient-added · Not clinically verified',
    },
    { name: 'Losartan', dose: '50 mg · 1 tablet', time: '7:00 AM', source: 'Doctor-issued' },
    {
      name: 'Cetirizine',
      dose: '10 mg · 1 tablet',
      time: '6:00 PM',
      source: 'Patient-added · Not clinically verified',
    },
  ];
  readonly notices = [
    { title: 'Full blood count', source: 'Central Laboratory', date: '20 Oct 2026' },
    { title: 'Blood glucose report', source: 'Patient-added', date: '12 Sep 2026' },
  ];
  readonly weekActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    return {
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      date: date.toISOString().slice(0, 10),
      taken: 0,
      total: 0,
      height: 0,
    };
  });
  readonly todayLabel = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());
  readonly activeAccess = 1;
  readonly takenCount = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');
      this.showPreviewTools.set(params.has('preview'));
      this.state.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' ? preview : 'ready',
      );
    });
  }

  get hasData(): boolean {
    return this.state() !== 'empty';
  }
  get visibleMedicines() {
    return this.hasData ? this.medicines : [];
  }
  get visibleNotices() {
    return this.hasData ? this.notices : [];
  }
  get responsePercent(): number {
    return this.medicines.length ? Math.round((this.takenCount / this.medicines.length) * 100) : 0;
  }

  timelinePosition(time: string): number {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return Math.min(84, Math.max(0, ((hours * 60 + Number(match[2])) / 1440) * 100));
  }

  setPreviewState(state: DashboardState): void {
    this.state.set(state);
  }
  retry(): void {
    this.state.set('ready');
  }
}
