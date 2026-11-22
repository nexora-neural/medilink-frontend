import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { ActiveRoleService } from '../../../core/context/active-role.service';
import {
  LabUploadRequestApi,
  LaboratoryOption,
  UploadRequestResponse,
} from './lab-upload-request-api.service';

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

@Injectable()
export class PatientLabRequestState {
  private readonly api = inject(LabUploadRequestApi);
  private readonly roles = inject(ActiveRoleService);
  private readonly destroyRef = inject(DestroyRef);

  private generation = 0;
  private destroyed = false;

  readonly state = signal<LoadState>('denied');
  readonly laboratories = signal<LaboratoryOption[]>([]);
  readonly requests = signal<UploadRequestResponse[]>([]);

  readonly laboratoryPage = signal(1);
  readonly laboratoryTotal = signal(0);
  readonly requestPage = signal(1);
  readonly requestTotal = signal(0);

  readonly permitted = computed(
    () => this.roles.activeRole() === 'Patient' && this.roles.activeAccountId() !== null,
  );

  constructor() {
    effect(() => {
      const accountId = this.roles.activeAccountId();
      const role = this.roles.activeRole();

      untracked(() => {
        this.reset();

        if (accountId !== null && role === 'Patient') {
          void this.load(1, 1);
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.generation++;
    });
  }

  async load(
    laboratoryPage = this.laboratoryPage(),
    requestPage = this.requestPage(),
  ): Promise<void> {
    if (!this.permitted() || this.destroyed) return;

    const generation = ++this.generation;
    const accountId = this.roles.activeAccountId();

    this.state.set('loading');
    this.laboratories.set([]);
    this.requests.set([]);

    try {
      const [labs, requests] = await Promise.all([
        this.api.listLaboratories(laboratoryPage),
        this.api.listRequests(requestPage),
      ]);

      if (!this.isCurrent(generation, accountId)) return;

      this.laboratories.set(labs.items);
      this.laboratoryPage.set(labs.page);
      this.laboratoryTotal.set(labs.total);

      this.requests.set(requests.items);
      this.requestPage.set(requests.page);
      this.requestTotal.set(requests.total);

      this.state.set('ready');
    } catch (error: unknown) {
      if (!this.isCurrent(generation, accountId)) return;

      this.laboratories.set([]);
      this.requests.set([]);

      const accessDenied =
        error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);

      this.state.set(accessDenied ? 'denied' : 'error');
    }
  }

  private isCurrent(generation: number, accountId: string | null): boolean {
    return (
      !this.destroyed &&
      generation === this.generation &&
      accountId === this.roles.activeAccountId() &&
      this.permitted()
    );
  }

  private reset(): void {
    this.generation++;
    this.state.set('denied');
    this.laboratories.set([]);
    this.requests.set([]);
    this.laboratoryPage.set(1);
    this.laboratoryTotal.set(0);
    this.requestPage.set(1);
    this.requestTotal.set(0);
  }
}
