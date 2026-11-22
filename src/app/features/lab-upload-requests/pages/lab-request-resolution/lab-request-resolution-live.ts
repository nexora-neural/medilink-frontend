import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval } from 'rxjs';

import { ActiveOrganizationService } from '../../../../core/context/active-organization.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import {
  LabUploadRequestApi,
  ResolvedUploadRequest,
} from '../../services/lab-upload-request-api.service';

@Component({
  selector: 'app-lab-request-resolution-live',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './lab-request-resolution-live.html',
  styleUrl: './lab-request-resolution.scss',
})
export class LabRequestResolutionLive {
  private readonly api = inject(LabUploadRequestApi);
  private readonly roles = inject(ActiveRoleService);
  private readonly organizations = inject(ActiveOrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  private version = 0;
  private destroyed = false;

  private readonly result = signal<{
    accountId: string;
    laboratoryId: string;
    request: ResolvedUploadRequest;
  } | null>(null);

  readonly laboratoryId = this.organizations.activeOrganizationId;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly currentTime = signal(Date.now());

  readonly tokenControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(256)],
  });

  readonly permitted = computed(
    () => this.roles.activeRole() === 'Lab Staff' && this.roles.activeAccountId() !== null,
  );

  readonly resolved = computed(() => {
    const result = this.result();

    if (
      !this.permitted() ||
      !result ||
      result.accountId !== this.roles.activeAccountId() ||
      result.laboratoryId !== this.laboratoryId() ||
      Date.parse(result.request.expires_at) <= this.currentTime()
    ) {
      return null;
    }

    return result.request;
  });

  constructor() {
    effect(() => {
      this.roles.activeAccountId();
      this.roles.activeRole();
      this.laboratoryId();

      untracked(() => this.clear());
    });

    this.tokenControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.clearResult());

    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.currentTime.set(Date.now()));

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.version++;
    });
  }

  clear(): void {
    this.tokenControl.reset('', { emitEvent: false });
    this.clearResult();
  }

  private clearResult(): void {
    this.version++;
    this.result.set(null);
    this.error.set('');
    this.loading.set(false);
  }

  async resolve(): Promise<void> {
    if (!this.permitted() || this.loading() || this.destroyed) return;

    this.clearResult();
    this.tokenControl.markAsTouched();

    const laboratoryId = this.laboratoryId();
    const accountId = this.roles.activeAccountId();
    const token = this.tokenControl.value.trim();

    if (!laboratoryId || !accountId) {
      this.error.set('Select your laboratory in the workspace menu.');
      return;
    }

    if (this.tokenControl.invalid || !token) {
      this.error.set('Enter an upload request token of up to 256 characters.');
      return;
    }

    const version = ++this.version;
    this.loading.set(true);

    const isCurrent = () =>
      !this.destroyed &&
      version === this.version &&
      accountId === this.roles.activeAccountId() &&
      laboratoryId === this.laboratoryId() &&
      this.permitted();

    try {
      const request = await this.api.resolveRequest(laboratoryId, token);

      if (!isCurrent()) return;

      const expiresAt = Date.parse(request.expires_at);
      this.currentTime.set(Date.now());

      if (
        request.laboratory_id !== laboratoryId ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= this.currentTime()
      ) {
        this.error.set('This upload request is unavailable.');
        return;
      }

      this.result.set({ accountId, laboratoryId, request });
    } catch (error: unknown) {
      if (!isCurrent()) return;

      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.error.set(
          'This upload request is unavailable. Check the token and selected laboratory.',
        );
      } else if (
        error instanceof HttpErrorResponse &&
        (error.status === 401 || error.status === 403)
      ) {
        this.error.set(
          'Access denied. A verified Lab Staff membership for this laboratory is required.',
        );
      } else if (error instanceof HttpErrorResponse && error.status === 429) {
        this.error.set('Too many attempts. Please wait before trying again.');
      } else {
        this.error.set('The request could not be checked. Please try again.');
      }
    } finally {
      if (isCurrent()) {
        this.loading.set(false);
      }
    }
  }
}
