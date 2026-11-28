import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { SAMPLE_DOCTOR_ID } from '../../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionDraft,
  PrescriptionPageState,
  PrescriptionStatus,
} from '../../models/prescription-draft.model';
import { PrescriptionDraftPreviewStore } from '../../services/prescription-draft-preview.store';

@Component({
  selector: 'app-prescription-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './prescription-list.html',
  styleUrl: './prescription-list.scss',
})
export class PrescriptionList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PrescriptionDraftPreviewStore);

  readonly pageState = signal<PrescriptionPageState>('ready');
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');
  readonly favorites = computed(() => this.store.listFavorites(SAMPLE_DOCTOR_ID));
  readonly templates = computed(() => this.store.listTemplates(SAMPLE_DOCTOR_ID));
  readonly renewalId = signal('');
  readonly renewalReason = signal('');
  readonly renewalError = signal('');
  readonly renewalPending = signal(false);
  readonly statusLabels: Record<PrescriptionStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    superseded: 'Superseded',
    completed: 'Completed',
    cancelled: 'Cancelled',
    discontinued: 'Discontinued',
  };

  readonly permitted = computed(() => this.roles.activeRole() === 'Doctor');

  readonly prescriptions = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') return [];

    const query = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.store
      .list()
      .filter(
        (prescription) =>
          (status === 'all' || prescription.status === status) &&
          (!query ||
            [prescription.id, prescription.patientName, prescription.patientReference].some(
              (value) => value.toLowerCase().includes(query),
            )),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );
    });
  }

  search(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  filterStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  canEdit(prescription: PrescriptionDraft): boolean {
    return this.permitted() && canEditPrescriptionDraft(prescription, SAMPLE_DOCTOR_ID);
  }

  canRenew(prescription: PrescriptionDraft): boolean {
    return (
      this.permitted() &&
      prescription.source === 'doctor' &&
      prescription.ownerDoctorId === SAMPLE_DOCTOR_ID &&
      (prescription.status === 'active' || prescription.status === 'completed')
    );
  }

  openRenewal(prescription: PrescriptionDraft): void {
    if (!this.canRenew(prescription)) return;
    this.renewalId.set(prescription.id);
    this.renewalReason.set('');
    this.renewalError.set('');
  }

  cancelRenewal(): void {
    if (this.renewalPending()) return;
    this.renewalId.set('');
    this.renewalReason.set('');
    this.renewalError.set('');
  }

  async createRenewalDraft(prescription: PrescriptionDraft): Promise<void> {
    if (!this.canRenew(prescription) || this.renewalId() !== prescription.id) return;
    const reason = this.renewalReason().trim();
    if (!reason || reason.length > 1000) {
      this.renewalError.set('Enter a reason between 1 and 1000 characters.');
      return;
    }

    this.renewalPending.set(true);
    this.renewalError.set('');
    try {
      const draft = this.store.createLinkedDraft(prescription.id, 'renew', reason);
      const navigated = await this.router.navigate([
        '/workspace/doctor/prescriptions',
        draft.id,
        'edit',
      ]);
      if (!navigated) {
        this.renewalError.set(
          'A sample draft was created. Open it from the prescription list to continue editing.',
        );
      }
    } catch (error) {
      this.renewalError.set(
        error instanceof Error ? error.message : 'Unable to prepare a sample renewal draft.',
      );
    } finally {
      this.renewalPending.set(false);
    }
  }

  removeFavorite(id: string): void {
    if (!this.permitted()) return;
    this.store.removeFavorite(SAMPLE_DOCTOR_ID, id);
  }

  removeTemplate(id: string): void {
    if (!this.permitted()) return;
    this.store.removeTemplate(SAMPLE_DOCTOR_ID, id);
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
  }
}
