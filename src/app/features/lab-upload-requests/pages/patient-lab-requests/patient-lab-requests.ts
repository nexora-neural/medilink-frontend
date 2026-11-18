import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  createApprovedSampleLabs,
  createSampleRequests,
  SAMPLE_PATIENT_ID,
} from '../../data/lab-upload-request.samples';
import {
  getLabRequestStatus,
  LAB_REQUEST_STATUS_LABELS,
  LabRequestPageState,
  LabUploadRequest,
} from '../../models/lab-upload-request.model';

@Component({
  selector: 'app-patient-lab-requests',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, UiState],
  templateUrl: './patient-lab-requests.html',
  styleUrl: './patient-lab-requests.scss',
})
export class PatientLabRequests {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);

  readonly labs = createApprovedSampleLabs();
  readonly statusLabels = LAB_REQUEST_STATUS_LABELS;
  readonly requests = signal<LabUploadRequest[]>(createSampleRequests());
  readonly pageState = signal<LabRequestPageState>('ready');
  readonly currentTime = signal(Date.now());

  readonly message = signal('');
  readonly error = signal('');
  readonly pendingRevoke = signal<string | null>(null);

  readonly labControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly permitted = computed(() => this.roles.activeRole() === 'Patient');

  readonly canManage = computed(
    () => this.permitted() && (this.pageState() === 'ready' || this.pageState() === 'empty'),
  );

  readonly visibleRequests = computed(() => {
    if (!this.permitted() || this.pageState() !== 'ready') {
      return [];
    }

    return this.requests()
      .filter((request) => request.patientId === SAMPLE_PATIENT_ID)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  readonly selectedRevoke = computed(
    () => this.visibleRequests().find((request) => request.id === this.pendingRevoke()) ?? null,
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const preview = params.get('preview');

      this.pageState.set(
        preview === 'loading' || preview === 'empty' || preview === 'error' || preview === 'denied'
          ? preview
          : 'ready',
      );

      this.labControl.reset('');
      this.pendingRevoke.set(null);
      this.message.set('');
      this.error.set('');
    });

    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.currentTime.set(Date.now()));
  }

  status(request: LabUploadRequest) {
    return getLabRequestStatus(request, this.currentTime());
  }

  labName(labId: string): string {
    return this.labs.find((lab) => lab.id === labId)?.name ?? 'Lab unavailable';
  }

  createRequest(): void {
    if (!this.canManage() || this.pendingRevoke() !== null) return;

    this.message.set('');
    this.error.set('');
    this.labControl.markAsTouched();

    const lab = this.labs.find((item) => item.id === this.labControl.value);

    if (this.labControl.invalid || !lab) {
      this.error.set('Select an approved sample laboratory.');
      return;
    }

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const id = crypto.randomUUID();

    const request: LabUploadRequest = {
      id: `local-preview-${id}`,
      reference: `sample_${id.replaceAll('-', '')}`,
      patientId: SAMPLE_PATIENT_ID,
      labId: lab.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sevenDays).toISOString(),
      revokedAt: null,
    };

    this.requests.update((items) =>
      this.pageState() === 'empty' ? [request] : [request, ...items],
    );

    this.currentTime.set(now);
    this.pageState.set('ready');
    this.labControl.reset('');
    this.message.set(
      'Sample request created for seven days. It will be lost when you leave or refresh.',
    );
  }

  requestRevoke(request: LabUploadRequest): void {
    if (!this.canManage() || this.pendingRevoke() !== null) return;

    const current = this.visibleRequests().find((item) => item.id === request.id);

    if (!current || getLabRequestStatus(current, Date.now()) !== 'active') {
      return;
    }

    this.message.set('');
    this.error.set('');
    this.pendingRevoke.set(current.id);
  }

  cancelRevoke(): void {
    this.pendingRevoke.set(null);
    this.error.set('');
  }

  confirmRevoke(): void {
    if (!this.canManage()) return;

    const selected = this.selectedRevoke();
    const now = Date.now();

    this.currentTime.set(now);

    if (!selected || getLabRequestStatus(selected, now) !== 'active') {
      this.pendingRevoke.set(null);
      this.error.set('This sample request is no longer active.');
      return;
    }

    this.requests.update((items) =>
      items.map((request) =>
        request.id === selected.id
          ? { ...request, revokedAt: new Date(now).toISOString() }
          : request,
      ),
    );

    this.pendingRevoke.set(null);
    this.error.set('');
    this.message.set('Sample request revoked in this preview.');
  }

  retry(): void {
    if (!this.permitted() || this.pageState() !== 'error') return;

    this.currentTime.set(Date.now());
    this.pageState.set('ready');
    this.error.set('');
  }
}
