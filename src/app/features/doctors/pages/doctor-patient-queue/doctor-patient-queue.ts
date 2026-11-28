import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DoctorPatientQueueApi,
  QueueEntry,
  Consultation,
} from './doctor-patient-queue-api.service';

type QueueStatus = 'waiting' | 'in-consultation' | 'completed' | 'unknown';
type AccessStatus = 'active' | 'expired' | 'revoked';
type ConsultationPermission = 'granted' | 'not-granted';
interface QueuePatient {
  id: string;
  name: string;
  referenceNumber: string;
  lastVisit: string;
  readAccess: AccessStatus;
  hasPrescriptionAccess: boolean;
  consultationPermission: ConsultationPermission;
  consultationContext: string;
  status: QueueStatus;
  grantId: string;
  grantIds: string[];
  consultationId: string | null;
}
@Component({
  selector: 'app-doctor-patient-queue',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './doctor-patient-queue.html',
  styleUrl: './doctor-patient-queue.scss',
})
export class DoctorPatientQueue {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DoctorPatientQueueApi);
  readonly searchTerm = signal('');
  readonly selectedFilter = signal<'all' | QueueStatus>('all');
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly validationMessage = signal('');
  readonly actionInProgress = signal<string | null>(null);
  readonly patients = signal<QueuePatient[]>([]);
  readonly consultationHistory = signal<Record<string, Consultation[]>>({});
  readonly filteredPatients = computed(() => {
    const term = this.searchTerm().trim().toLowerCase(),
      filter = this.selectedFilter();
    return this.patients().filter(
      (p) =>
        (p.name.toLowerCase().includes(term) || p.referenceNumber.toLowerCase().includes(term)) &&
        (filter === 'all' || p.status === filter),
    );
  });
  readonly waitingCount = computed(
    () => this.patients().filter((p) => p.status === 'waiting').length,
  );
  readonly consultationCount = computed(
    () => this.patients().filter((p) => p.status === 'in-consultation').length,
  );
  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      if (params.has('preview')) {
        this.errorMessage.set('Preview links are disabled for the live patient queue.');
        this.loading.set(false);
      } else void this.loadQueue();
    });
  }
  async loadQueue(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const all: QueueEntry[] = [];
      let page = 1,
        total = 0;
      do {
        const result = await this.api.list(page++);
        all.push(...result.items);
        total = result.total;
        if (!result.items.length) break;
      } while (all.length < total);
      const grouped = new Map<
        string,
        Omit<QueuePatient, 'hasPrescriptionAccess'> & { categories: Set<string> }
      >();
      for (const x of all) {
        const id = x.patient.patient_user_id;
        let patient = grouped.get(id);
        if (!patient) {
          patient = {
            id,
            name: x.patient.display_name,
            referenceNumber: id,
            lastVisit: '—',
            // The queue endpoint only returns grants that are currently active.
            // The server remains authoritative for expiry and revocation decisions.
            readAccess: 'active',
            consultationPermission: 'not-granted',
            consultationContext: '',
            status: 'unknown',
            grantId: x.grant_id,
            grantIds: [],
            consultationId: null,
            categories: new Set<string>(),
          };
          grouped.set(id, patient);
        }
        patient.grantIds.push(x.grant_id);
        x.categories.forEach((category) => patient.categories.add(category));
        if (x.allow_consultation) {
          patient.consultationPermission = 'granted';
          patient.grantId = x.grant_id;
        }
      }
      const active = [...grouped.values()].map(({ categories, ...patient }) => ({
        ...patient,
        hasPrescriptionAccess: categories.has('prescriptions'),
        consultationContext: [...categories].join(', '),
      }));
      this.patients.set(active);
      this.consultationHistory.set({});
      for (const p of active) {
        await this.refreshPatientHistory(p.id);
      }
    } catch (e) {
      this.patients.set([]);
      this.errorMessage.set(this.message(e, 'The patient queue could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }
  async refreshPatientHistory(id: string): Promise<void> {
    const p = this.patients().find((patient) => patient.id === id);
    if (!p) return;
    this.patchPatient(id, { status: 'unknown', consultationId: null });
    try {
      const history = await this.loadAllConsultations(id);
      const current = history.filter((c) => p.grantIds.includes(c.grant_id));
      this.consultationHistory.update((h) => ({ ...h, [id]: history }));
      const running = current.find((c) => !c.ended_at);
      this.patchPatient(
        id,
        running
          ? { status: 'in-consultation', consultationId: running.id, grantId: running.grant_id }
          : { status: current.length ? 'completed' : 'waiting', consultationId: null },
      );
    } catch {
      this.patchPatient(id, { status: 'unknown', consultationId: null });
    }
  }
  retry(): void {
    void this.loadQueue();
  }
  updateSearch(v: string): void {
    this.searchTerm.set(v);
  }
  updateFilter(v: 'all' | QueueStatus): void {
    this.selectedFilter.set(v);
  }
  async startConsultation(id: string): Promise<void> {
    const p = this.patients().find((x) => x.id === id);
    if (!p || p.status !== 'waiting') return;
    if (p.readAccess !== 'active' || p.consultationPermission !== 'granted') {
      this.validationMessage.set(
        'Active patient record access and separate consultation permission are both required.',
      );
      return;
    }
    this.actionInProgress.set(id);
    this.validationMessage.set('');
    try {
      const c = await this.api.start(p.grantId);
      this.patchPatient(id, { status: 'in-consultation', consultationId: c.id });
      await this.loadHistory(p);
    } catch (e) {
      this.validationMessage.set(
        this.message(e, 'Consultation could not be started. Refresh and check access.'),
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }
  async endConsultation(id: string): Promise<void> {
    const p = this.patients().find((x) => x.id === id);
    if (!p?.consultationId || p.status !== 'in-consultation') return;
    this.actionInProgress.set(id);
    this.validationMessage.set('');
    try {
      await this.api.end(p.consultationId);
      this.patchPatient(id, { status: 'completed', consultationId: null });
      await this.loadHistory(p);
    } catch (e) {
      this.validationMessage.set(
        this.message(e, 'Consultation could not be ended. Refresh and retry.'),
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }
  private async loadHistory(p: QueuePatient): Promise<void> {
    try {
      const history = await this.loadAllConsultations(p.id);
      this.consultationHistory.update((h) => ({ ...h, [p.id]: history }));
    } catch {
      this.patchPatient(p.id, { status: 'unknown', consultationId: null });
    }
  }
  private async loadAllConsultations(patientId: string): Promise<Consultation[]> {
    const all: Consultation[] = [];
    let page = 1,
      total = 0;
    do {
      const result = await this.api.listConsultations(patientId, page++);
      all.push(...result.items);
      total = result.total;
      if (!result.items.length) break;
    } while (all.length < total);
    return all;
  }
  private patchPatient(id: string, patch: Partial<QueuePatient>): void {
    this.patients.update((items) => items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  private message(e: unknown, fallback: string): string {
    const err = e as { status?: number; error?: { message?: string } };
    if (err.status === 401) return 'Sign in again to view the patient queue.';
    if (err.status === 403) return 'Your account does not have access to this patient or action.';
    if (err.status === 404 || err.status === 409)
      return 'The patient permission is no longer available. Refresh the queue and try again.';
    if (!err.status || err.status >= 500)
      return 'The service is unavailable. Check the connection and retry.';
    return err.error?.message ?? fallback;
  }
}
