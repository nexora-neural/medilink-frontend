import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { SAMPLE_DOCTOR_ID } from '../../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionDraft,
  PrescriptionPageState,
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
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PrescriptionDraftPreviewStore);

  readonly pageState = signal<PrescriptionPageState>('ready');
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');

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

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
  }
}
