import { Component, computed, signal } from '@angular/core';

type QueueStatus = 'waiting' | 'in-consultation' | 'completed';

type AccessStatus = 'active' | 'expired' | 'revoked';

type ConsultationPermission = 'granted' | 'not-granted' | 'expired';

interface QueuePatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  referenceNumber: string;
  lastVisit: string;
  accessLabel: string;
  readAccess: AccessStatus;
  consultationPermission: ConsultationPermission;
  consultationContext: string;
  status: QueueStatus;
}

@Component({
  selector: 'app-doctor-patient-queue',
  standalone: true,
  imports: [],
  templateUrl: './doctor-patient-queue.html',
  styleUrl: './doctor-patient-queue.scss',
})
export class DoctorPatientQueue {
  readonly searchTerm = signal('');
  readonly selectedFilter = signal<'all' | QueueStatus>('all');
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly validationMessage = signal('');

  // Temporary preview data only.
  // ML-70 will replace this with verified API data.
  readonly patients = signal<QueuePatient[]>([
    {
      id: 'P-1042',
      name: 'Nadeesha Perera',
      age: 42,
      gender: 'Female',
      referenceNumber: 'ML-P-1042',
      lastVisit: '18 Nov 2026',
      accessLabel: 'Read access active',
      readAccess: 'active',
      consultationPermission: 'granted',
      consultationContext: 'Follow-up consultation',
      status: 'waiting',
    },
    {
      id: 'P-1085',
      name: 'Kasun Fernando',
      age: 35,
      gender: 'Male',
      referenceNumber: 'ML-P-1085',
      lastVisit: '20 Nov 2026',
      accessLabel: 'Read access active',
      readAccess: 'active',
      consultationPermission: 'granted',
      consultationContext: 'General consultation',
      status: 'in-consultation',
    },
    {
      id: 'P-1120',
      name: 'Amaya Silva',
      age: 29,
      gender: 'Female',
      referenceNumber: 'ML-P-1120',
      lastVisit: '15 Nov 2026',
      accessLabel: 'Read access active',
      readAccess: 'active',
      consultationPermission: 'not-granted',
      consultationContext: 'Routine follow-up',
      status: 'completed',
    },
  ]);

  readonly filteredPatients = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.selectedFilter();

    return this.patients().filter((patient) => {
      const matchesSearch =
        patient.name.toLowerCase().includes(term) ||
        patient.referenceNumber.toLowerCase().includes(term);

      const matchesFilter = filter === 'all' || patient.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  readonly waitingCount = computed(
    () => this.patients().filter((patient) => patient.status === 'waiting').length,
  );

  readonly consultationCount = computed(
    () => this.patients().filter((patient) => patient.status === 'in-consultation').length,
  );

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  updateFilter(value: 'all' | QueueStatus): void {
    this.selectedFilter.set(value);
  }

  startConsultation(patientId: string): void {
    const patient = this.patients().find((item) => item.id === patientId);

    if (!patient) {
      this.validationMessage.set('Patient could not be found.');
      return;
    }

    if (patient.status !== 'waiting') {
      this.validationMessage.set('Consultation can only be started for a waiting patient.');
      return;
    }

    if (patient.readAccess !== 'active') {
      this.validationMessage.set(
        'Active patient read access is required before starting a consultation.',
      );
      return;
    }

    if (patient.consultationPermission !== 'granted') {
      this.validationMessage.set('The patient has not granted consultation permission.');
      return;
    }

    this.patients.update((patients) =>
      patients.map((item) =>
        item.id === patientId ? { ...item, status: 'in-consultation' } : item,
      ),
    );

    this.validationMessage.set('');
  }

  endConsultation(patientId: string): void {
    const patient = this.patients().find((item) => item.id === patientId);

    if (!patient) {
      this.validationMessage.set('Patient could not be found.');
      return;
    }

    if (patient.status !== 'in-consultation') {
      this.validationMessage.set('Only an active consultation can be ended.');
      return;
    }

    this.patients.update((patients) =>
      patients.map((item) => (item.id === patientId ? { ...item, status: 'completed' } : item)),
    );

    this.validationMessage.set('');
  }
}
