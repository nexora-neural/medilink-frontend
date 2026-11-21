import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { SAMPLE_DOCTOR_ID } from '../../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionPageState,
} from '../../models/prescription-draft.model';
import { PrescriptionDraftPreviewStore } from '../../services/prescription-draft-preview.store';

@Component({
  selector: 'app-prescription-detail',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './prescription-detail.html',
  styleUrl: '../prescription-list/prescription-list.scss',
})
export class PrescriptionDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PrescriptionDraftPreviewStore);

  readonly prescriptionId = signal('');
  readonly pageState = signal<PrescriptionPageState>('ready');
  readonly permitted = computed(() => this.roles.activeRole() === 'Doctor');

  readonly prescription = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') return null;

    return this.store.find(this.prescriptionId());
  });

  readonly editable = computed(() => {
    const prescription = this.prescription();

    return prescription !== null && canEditPrescriptionDraft(prescription, SAMPLE_DOCTOR_ID);
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.prescriptionId.set(params.get('id') ?? '');
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );
    });
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
  }
}
