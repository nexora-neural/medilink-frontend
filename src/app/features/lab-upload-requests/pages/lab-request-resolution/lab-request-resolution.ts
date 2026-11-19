import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  createApprovedSampleLabs,
  createSampleRequests,
  SAMPLE_ACTIVE_REFERENCE,
  SAMPLE_PATIENT_ID,
  SAMPLE_STAFF_LAB_ID,
} from '../../data/lab-upload-request.samples';
import {
  getLabRequestStatus,
  LabRequestPageState,
  LabUploadRequest,
  ResolvedLabRequest,
} from '../../models/lab-upload-request.model';

@Component({
  selector: 'app-lab-request-resolution',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, UiState],
  templateUrl: './lab-request-resolution.html',
  styleUrl: './lab-request-resolution.scss',
})
export class LabRequestResolution {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly samples = createSampleRequests();
  private readonly labs = createApprovedSampleLabs();
  private readonly selected = signal<LabUploadRequest | null>(null);

  readonly sampleReference = SAMPLE_ACTIVE_REFERENCE;
  readonly pageState = signal<LabRequestPageState>('ready');
  readonly currentTime = signal(Date.now());
  readonly error = signal('');
  readonly searched = signal(false);

  readonly referenceControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });

  readonly permitted = computed(() => this.roles.activeRole() === 'Lab Staff');

  readonly canResolve = computed(
    () => this.permitted() && (this.pageState() === 'ready' || this.pageState() === 'empty'),
  );

  readonly resolved = computed<ResolvedLabRequest | null>(() => {
    const request = this.selected();

    if (
      !this.canResolve() ||
      !request ||
      request.labId !== SAMPLE_STAFF_LAB_ID ||
      request.patientId !== SAMPLE_PATIENT_ID ||
      getLabRequestStatus(request, this.currentTime()) !== 'active'
    ) {
      return null;
    }

    return {
      reference: request.reference,
      patientLabel: 'Sample Patient',
      labName: this.labs.find((lab) => lab.id === request.labId)?.name ?? 'Sample laboratory',
      expiresAt: request.expiresAt,
    };
  });

  constructor() {
    effect(() => {
      if (!this.permitted()) {
        this.referenceControl.reset('', { emitEvent: false });
        this.clearResult();
      }
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );

      this.referenceControl.reset('');
      this.clearResult();
    });

    this.referenceControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.clearResult());

    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.currentTime.set(Date.now()));
  }

  useSampleReference(): void {
    if (!this.canResolve()) return;

    this.referenceControl.setValue(this.sampleReference);
  }

  resolve(): void {
    if (!this.canResolve()) return;

    this.clearResult();
    this.referenceControl.markAsTouched();
    this.searched.set(true);

    const reference = this.referenceControl.value.trim();

    if (this.referenceControl.invalid || !reference) {
      this.error.set('Enter a sample request reference of up to 100 characters.');
      return;
    }

    const request =
      this.pageState() === 'empty'
        ? undefined
        : this.samples.find((item) => item.reference === reference);

    const now = Date.now();
    this.currentTime.set(now);

    if (
      !request ||
      request.labId !== SAMPLE_STAFF_LAB_ID ||
      request.patientId !== SAMPLE_PATIENT_ID ||
      getLabRequestStatus(request, now) !== 'active'
    ) {
      this.error.set(
        'This sample request is unavailable. It may be invalid, expired, revoked or assigned to another laboratory.',
      );
      return;
    }

    this.selected.set(request);
  }

  clearResult(): void {
    this.selected.set(null);
    this.error.set('');
    this.searched.set(false);
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.pageState.set('ready');
    this.currentTime.set(Date.now());
    this.clearResult();
  }
}
