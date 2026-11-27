import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  AllergyStatus,
  CLINICAL_ENTRY_LABELS,
  CLINICAL_SOURCE_LABELS,
  CLINICAL_STATUS_LABELS,
} from '../../models/clinical-record.model';
import { ClinicalRecordApiService, RecordPage } from '../../services/clinical-record-api.service';

type State =
  | { kind: 'loading' | 'denied' | 'expired' | 'error' }
  | { kind: 'ready'; history: RecordPage; allergy: AllergyStatus };

/** The queue's direct patient route stays read-only, independently of writable history. */
@Component({
  selector: 'app-doctor-patient-records',
  imports: [DatePipe, RouterLink, UiState],
  templateUrl: './doctor-patient-records.html',
  styleUrl: './clinical-records.scss',
})
export class DoctorPatientRecords {
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly api = inject(ClinicalRecordApiService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly revision = signal(0);
  private readonly page = signal<{ patient: string; value: number } | null>(null);
  readonly account = computed(() =>
    this.roles.activeRole() === 'Doctor' && this.roles.roles().includes('Doctor')
      ? this.roles.activeAccountId()
      : null,
  );
  private readonly request = computed(() => {
    const patient = this.params()?.get('id') ?? '';
    const page = this.page();
    return {
      account: this.account(),
      patient,
      page: page?.patient === patient ? page.value : 1,
      revision: this.revision(),
    };
  });
  private readonly result = signal<{
    request: ReturnType<DoctorPatientRecords['request']>;
    state: State;
  } | null>(null);
  readonly state = computed<State>(() => {
    const request = this.request();
    if (!request.account) return { kind: 'denied' };
    if (!request.patient) return { kind: 'error' };
    const result = this.result();
    return result?.request === request ? result.state : { kind: 'loading' };
  });
  readonly entries = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.history.items : [];
  });
  readonly labels = CLINICAL_ENTRY_LABELS;
  readonly sources = CLINICAL_SOURCE_LABELS;
  readonly statuses = CLINICAL_STATUS_LABELS;
  constructor() {
    effect((cleanup) => {
      const request = this.request();
      if (!request.account || !request.patient) return;
      let current = true;
      cleanup(() => {
        current = false;
      });
      void Promise.all([
        this.api.list(request.patient, request.page),
        this.api.allergyStatus(request.patient),
      ]).then(
        ([history, allergy]) => {
          if (current && this.request() === request)
            this.result.set({ request, state: { kind: 'ready', history, allergy } });
        },
        (error: unknown) => {
          if (current && this.request() === request)
            this.result.set({ request, state: { kind: this.failure(error) } });
        },
      );
    });
  }
  refresh(): void {
    this.page.set(null);
    this.revision.update((value) => value + 1);
  }
  changePage(value: number): void {
    const state = this.state();
    if (
      state.kind !== 'ready' ||
      value < 1 ||
      value > Math.ceil(state.history.total / state.history.pageSize)
    )
      return;
    this.page.set({ patient: this.request().patient, value });
  }
  private failure(error: unknown): 'denied' | 'expired' | 'error' {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'expired';
      if (error.status === 403 || error.status === 404) return 'denied';
    }
    if (
      error instanceof Error &&
      (error.message === 'Please sign in to continue.' ||
        ('code' in error &&
          ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled'].includes(
            String(error.code),
          )))
    )
      return 'expired';
    return 'error';
  }
}
