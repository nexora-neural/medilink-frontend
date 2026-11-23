import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  private readonly router = inject(Router);
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

  readonly action = signal<'complete' | 'cancel' | 'discontinue'>('complete');
  readonly reason = signal('');
  readonly actionError = signal('');
  readonly actionMessage = signal('');

  readonly canFinish = computed(() => {
    const prescription = this.prescription();

    return (
      prescription !== null &&
      prescription.status === 'active' &&
      prescription.source === 'doctor' &&
      prescription.ownerDoctorId === SAMPLE_DOCTOR_ID
    );
  });

  selectAction(value: string): void {
    if (value === 'complete' || value === 'cancel' || value === 'discontinue') {
      this.action.set(value);
      this.actionError.set('');
      this.actionMessage.set('');
    }
  }

  finishPrescription(): void {
    this.actionError.set('');
    this.actionMessage.set('');

    if (!this.canFinish()) {
      this.actionError.set('This action is unavailable for this prescription.');
      return;
    }

    try {
      const updated = this.store.finish(this.prescriptionId(), this.action(), this.reason());

      this.reason.set('');
      this.actionMessage.set(`Sample prescription marked as ${updated.status}.`);
    } catch (error) {
      this.actionError.set(
        error instanceof Error
          ? error.message
          : 'Unable to update the sample prescription. Please try again.',
      );
    }
  }

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
  readonly linkedAction = signal<'correct' | 'renew' | 'reissue'>('correct');
  readonly linkedReason = signal('');
  readonly linkedError = signal('');

  readonly canCreateLinkedDraft = computed(() => {
    const prescription = this.prescription();

    return (
      prescription !== null &&
      prescription.source === 'doctor' &&
      prescription.ownerDoctorId === SAMPLE_DOCTOR_ID &&
      (prescription.status === 'active' || prescription.status === 'completed')
    );
  });

  selectLinkedAction(value: string): void {
    if (value === 'correct' || value === 'renew' || value === 'reissue') {
      this.linkedAction.set(value);
      this.linkedError.set('');
    }
  }

  async createLinkedDraft(): Promise<void> {
    this.linkedError.set('');

    if (!this.canCreateLinkedDraft()) {
      this.linkedError.set('This action is unavailable.');
      return;
    }

    let draftId: string;

    try {
      const draft = this.store.createLinkedDraft(
        this.prescriptionId(),
        this.linkedAction(),
        this.linkedReason(),
      );

      draftId = draft.id;
      this.linkedReason.set('');
    } catch (error) {
      this.linkedError.set(
        error instanceof Error ? error.message : 'Unable to create sample draft.',
      );
      return;
    }

    try {
      const navigated = await this.router.navigate([
        '/workspace/doctor/prescriptions',
        draftId,
        'edit',
      ]);

      if (!navigated) {
        this.linkedError.set('Draft created. Open the linked prescription from History.');
      }
    } catch {
      this.linkedError.set('Draft created. Open the linked prescription from History.');
    }
  }
}
