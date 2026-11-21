import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { LabUploadRequestApi } from '../../services/lab-upload-request-api.service';

import { UiState } from '../../../../shared/components/ui-state/ui-state';
import { PatientLabRequestState } from '../../services/patient-lab-request-state';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-patient-lab-requests-live',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, UiState],
  providers: [PatientLabRequestState],
  templateUrl: './patient-lab-requests-live.html',
  styleUrl: './patient-lab-requests.scss',
})
export class PatientLabRequestsLive {
  readonly data = inject(PatientLabRequestState);
  private readonly api = inject(LabUploadRequestApi);
  private readonly roles = inject(ActiveRoleService);
  private readonly destroyRef = inject(DestroyRef);

  private operationVersion = 0;
  private destroyed = false;

  readonly creating = signal(false);
  readonly createdToken = signal<string | null>(null);
  readonly createError = signal('');
  readonly revoking = signal(false);
  readonly pendingRevokeId = signal<string | null>(null);
  readonly revokeError = signal('');

  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  readonly selectedRevoke = computed(() => {
    if (!this.data.permitted() || this.data.state() !== 'ready') {
      return null;
    }

    return this.data.requests().find((request) => request.id === this.pendingRevokeId()) ?? null;
  });

  readonly labControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly canCreate = computed(
    () =>
      this.data.permitted() &&
      this.data.state() === 'ready' &&
      !this.creating() &&
      !this.revoking() &&
      this.pendingRevokeId() === null,
  );

  constructor() {
    effect(() => {
      this.roles.activeAccountId();
      this.roles.activeRole();

      untracked(() => {
        this.operationVersion++;
        this.creating.set(false);
        this.createdToken.set(null);
        this.createError.set('');
        this.labControl.reset('', { emitEvent: false });
        this.revoking.set(false);
        this.pendingRevokeId.set(null);
        this.revokeError.set('');
        this.reasonControl.reset('', { emitEvent: false });
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.operationVersion++;
    });
  }

  async createRequest(): Promise<void> {
    if (!this.canCreate() || this.destroyed) return;

    this.labControl.markAsTouched();
    this.createError.set('');

    const laboratoryId = this.labControl.value;
    const available = this.data.laboratories().some((lab) => lab.id === laboratoryId);

    if (this.labControl.invalid || !available) {
      this.createError.set('Select an available laboratory.');
      return;
    }

    const version = ++this.operationVersion;
    const accountId = this.roles.activeAccountId();
    this.creating.set(true);

    const isCurrent = () =>
      !this.destroyed &&
      version === this.operationVersion &&
      accountId === this.roles.activeAccountId() &&
      this.data.permitted();

    try {
      const result = await this.api.createRequest(laboratoryId);

      if (!isCurrent()) return;

      this.createdToken.set(result.request_token);
      this.labControl.reset('');

      await this.data.load(this.data.laboratoryPage(), 1);
    } catch {
      if (!isCurrent()) return;

      this.createError.set(
        'The request could not be confirmed. Refresh the request list before trying again.',
      );
    } finally {
      if (isCurrent()) {
        this.creating.set(false);
      }
    }
  }

  readonly statusLabels = {
    active: 'Active',
    used: 'Used',
    expired: 'Expired',
    revoked: 'Revoked',
  };

  labName(id: string): string {
    return this.data.laboratories().find((lab) => lab.id === id)?.name ?? `Laboratory ${id}`;
  }

  changeLaboratoryPage(offset: number): void {
    if (this.creating() || this.revoking() || this.pendingRevokeId() !== null) {
      return;
    }
    const next = this.data.laboratoryPage() + offset;
    const last = Math.max(1, Math.ceil(this.data.laboratoryTotal() / 20));

    if (next < 1 || next > last || this.data.state() !== 'ready') return;

    void this.data.load(next, this.data.requestPage());
  }

  changeRequestPage(offset: number): void {
    if (this.creating() || this.revoking() || this.pendingRevokeId() !== null) {
      return;
    }
    const next = this.data.requestPage() + offset;
    const last = Math.max(1, Math.ceil(this.data.requestTotal() / 20));

    if (next < 1 || next > last || this.data.state() !== 'ready') return;

    void this.data.load(this.data.laboratoryPage(), next);
  }
  requestRevoke(requestId: string): void {
    if (
      !this.data.permitted() ||
      this.data.state() !== 'ready' ||
      this.creating() ||
      this.revoking() ||
      this.pendingRevokeId() !== null
    ) {
      return;
    }

    const request = this.data.requests().find((item) => item.id === requestId);

    if (
      !request ||
      request.status !== 'active' ||
      request.used_at !== null ||
      Date.parse(request.expires_at) <= Date.now()
    ) {
      return;
    }

    this.revokeError.set('');
    this.reasonControl.reset('');
    this.pendingRevokeId.set(request.id);
  }

  cancelRevoke(): void {
    if (this.revoking()) return;

    this.pendingRevokeId.set(null);
    this.reasonControl.reset('');
    this.revokeError.set('');
  }

  async confirmRevoke(): Promise<void> {
    if (
      !this.data.permitted() ||
      this.data.state() !== 'ready' ||
      this.creating() ||
      this.revoking() ||
      this.destroyed
    ) {
      return;
    }

    const request = this.selectedRevoke();
    const reason = this.reasonControl.value.trim();

    this.reasonControl.markAsTouched();
    this.revokeError.set('');

    if (
      !request ||
      request.status !== 'active' ||
      request.used_at !== null ||
      Date.parse(request.expires_at) <= Date.now()
    ) {
      this.pendingRevokeId.set(null);
      this.revokeError.set('This request is no longer available for revocation.');
      return;
    }

    if (this.reasonControl.invalid || !reason || reason.includes('\u0000')) {
      this.revokeError.set('Enter a reason between 1 and 1000 characters.');
      return;
    }

    const version = ++this.operationVersion;
    const accountId = this.roles.activeAccountId();
    this.revoking.set(true);

    const isCurrent = () =>
      !this.destroyed &&
      version === this.operationVersion &&
      accountId === this.roles.activeAccountId() &&
      this.data.permitted();

    try {
      await this.api.revokeRequest(request.id, reason);

      if (!isCurrent()) return;

      this.pendingRevokeId.set(null);
      this.reasonControl.reset('');
      this.createdToken.set(null);

      await this.data.load();
    } catch (error: unknown) {
      if (!isCurrent()) return;

      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        this.pendingRevokeId.set(null);
        this.createdToken.set(null);
        this.data.requests.set([]);
        this.data.laboratories.set([]);
        this.data.state.set('denied');
      } else if (
        error instanceof HttpErrorResponse &&
        (error.status === 404 || error.status === 409)
      ) {
        this.pendingRevokeId.set(null);
        this.revokeError.set(
          'The request is no longer available for revocation. The list has been refreshed.',
        );
        await this.data.load();
      } else {
        this.revokeError.set(
          'Revocation could not be confirmed. Refresh the list before trying again.',
        );
      }
    } finally {
      if (isCurrent()) {
        this.revoking.set(false);
      }
    }
  }
}
