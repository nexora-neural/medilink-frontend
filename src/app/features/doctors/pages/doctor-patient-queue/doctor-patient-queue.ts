import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type QueueState = 'loading' | 'ready' | 'empty' | 'error';
type QueueFilter = 'all' | 'consultation';

interface QueuePatient {
  id: string;
  name: string;
  initials: string;
  ageLabel: string;
  detail: string;
  accessLabel: string;
  accessExpiresAt: string;
  consultationAllowed: boolean;
  categories: string[];
  lastActivity: string;
}

@Component({
  selector: 'app-doctor-patient-queue',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './doctor-patient-queue.html',
  styleUrl: './doctor-patient-queue.scss',
})
export class DoctorPatientQueue {
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<QueueState>('ready');
  readonly searchTerm = signal('');
  readonly activeFilter = signal<QueueFilter>('all');


  private readonly accessiblePatients: QueuePatient[] = [
    {
      id: 'P-1042',
      name: 'Nadeesha Perera',
      initials: 'NP',
      ageLabel: '34 years',
      detail: 'Hypertension',
      accessLabel: 'Active access',
      accessExpiresAt: '24 hours',
      consultationAllowed: true,
      categories: ['Medical history', 'Prescriptions', 'Reports'],
      lastActivity: 'Access shared recently',
    },
  ];

  readonly patients = computed(() => {
    if (this.state() !== 'ready') {
      return [];
    }

    const search = this.searchTerm().trim().toLowerCase();
    const filter = this.activeFilter();

    return this.accessiblePatients.filter((patient) => {
      const matchesSearch =
        !search ||
        patient.name.toLowerCase().includes(search) ||
        patient.id.toLowerCase().includes(search) ||
        patient.detail.toLowerCase().includes(search);

      const matchesFilter =
        filter === 'all' || (filter === 'consultation' && patient.consultationAllowed);

      return matchesSearch && matchesFilter;
    });
  });

  readonly totalPatients = computed(() =>
    this.state() === 'ready' ? this.accessiblePatients.length : 0,
  );

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const preview = params.get('preview');

      if (preview === 'loading' || preview === 'empty' || preview === 'error') {
        this.state.set(preview);
      } else {
        this.state.set('ready');
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onFilterChange(value: string): void {
    this.activeFilter.set(value === 'consultation' ? 'consultation' : 'all');
  }

  retry(): void {
    // Demo retry: restores the local preview state.
    this.state.set('ready');
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.activeFilter.set('all');
  }
}
