import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DashboardStatus,
  DoctorActivity,
  DoctorPatient,
  DoctorDashboardSummary,
} from './models/doctor-dashboard.models';
import { DashboardSummaryCards } from './components/dashboard-summary-cards/dashboard-summary-cards';
import { PatientQueue } from './components/patient-queue/patient-queue';
import { RecentActivityPanel } from './components/recent-activity-panel/recent-activity-panel';
import { DashboardStatusPanel } from './components/dashboard-status-panel/dashboard-status-panel';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DashboardSummaryCards,
    PatientQueue,
    RecentActivityPanel,
    DashboardStatusPanel,
  ],
  templateUrl: './doctor-dashboard.html',
  styleUrl: './doctor-dashboard.scss',
})
export class DoctorDashboard {
  private readonly route = inject(ActivatedRoute);

  readonly doctorName = 'Dr. Maya';
  readonly state = signal<DashboardStatus>('ready');
  readonly showPreviewTools = signal(false);
  readonly showQrPreview = signal(false);

  // The following is synthetic UI demo data only. No backend requests or claims
  // of authenticated verification, consent or clinical record access are made.
  private readonly samplePatients: DoctorPatient[] = [
    {
      id: 'P-1042',
      name: 'Nadeesha Perera',
      initials: 'NP',
      detail: 'Hypertension',
      accessLabel: 'Access active',
    },
  ];
  private readonly sampleActivities: DoctorActivity[] = [
    {
      id: 'a1',
      icon: 'description',
      title: 'Patient-added prescription',
      detail: 'Ready for your review · Nadeesha Perera',
      route: '/workspace/doctor/prescriptions',
    },
    {
      id: 'a2',
      icon: 'lab_profile',
      title: 'New laboratory report',
      detail: 'Full blood count · Nadeesha Perera',
      route: '/workspace/doctor/records',
    },
  ];
  private readonly sampleSummary: DoctorDashboardSummary = {
    patientsWithAccess: 1,
    patientRecords: 2,
    reviewNeeded: 1,
    verification: 'Verified',
  };

  readonly summary = computed<DoctorDashboardSummary>(() =>
    this.state() === 'ready'
      ? this.sampleSummary
      : { patientsWithAccess: 0, patientRecords: 0, reviewNeeded: 0, verification: 'Pending' },
  );
  readonly patients = computed(() => (this.state() === 'ready' ? this.samplePatients : []));
  readonly activities = computed(() => (this.state() === 'ready' ? this.sampleActivities : []));

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const preview = params.get('preview');
      this.showPreviewTools.set(params.has('preview'));
      this.state.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' ? preview : 'ready',
      );
    });
  }

  setPreviewState(state: DashboardStatus): void {
    this.state.set(state);
  }
  retry(): void {
    this.state.set('ready');
  }
  toggleQrPreview(): void {
    this.showQrPreview.update((show) => !show);
  }
}
