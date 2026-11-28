import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDetailResponse } from '../../models/prescription-api.model';
import { PrescriptionApiService } from '../../services/prescription-api.service';

@Component({
  selector: 'app-prescription-live-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <section class="prescription-page" aria-labelledby="live-prescription-heading">
      <header>
        <p class="eyebrow">Doctor workspace</p>
        <h1 id="live-prescription-heading">Prescriptions</h1>
        <p>View prescriptions for the selected patient.</p>
      </header>

      @if (state() === 'denied') {
        <section class="panel" role="alert">
          <h2>Access unavailable</h2>
          <p>You do not currently have access to these prescriptions.</p>
        </section>
      } @else if (!patientId()) {
        <section class="panel">
          <h2>Select a patient</h2>
          <p>Open prescriptions from a patient record to view their prescriptions.</p>
        </section>
      } @else if (state() === 'loading') {
        <section class="panel" role="status">
          <h2>Loading prescriptions</h2>
          <p>Please wait while the list loads.</p>
        </section>
      } @else if (state() === 'error') {
        <section class="panel" role="alert">
          <h2>Unable to load prescriptions</h2>
          <p>Please try again.</p>
          <button type="button" (click)="reload()">Try again</button>
        </section>
      } @else {
        <section class="panel">
          <h2>Patient prescriptions</h2>
          @if (patientId() && consultationId()) {
            <div class="actions">
              <a
                routerLink="/workspace/doctor/prescriptions/new/edit"
                [queryParams]="{
                  patientId: patientId(),
                  consultationId: consultationId(),
                }"
              >
                Create draft
              </a>
            </div>
          }
          <p>Patient reference: {{ patientId() }}</p>
          <p role="status">{{ prescriptions().length }} of {{ total() }} prescription(s) shown</p>

          <div class="prescription-list">
            @for (detail of prescriptions(); track detail.prescription.id) {
              <article class="prescription-card">
                <div class="card-heading">
                  <h3>Prescription</h3>
                  <span class="badge">{{ detail.prescription.status }}</span>
                </div>

                <dl>
                  <div>
                    <dt>Prescription ID</dt>
                    <dd>{{ detail.prescription.id }}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{{ detail.prescription.source }}</dd>
                  </div>
                  <div>
                    <dt>Medicines</dt>
                    <dd>{{ detail.items.length }}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{{ detail.prescription.updated_at | date: 'medium' }}</dd>
                  </div>
                </dl>
                <a
                  [routerLink]="['/workspace/doctor/prescriptions', detail.prescription.id]"
                  [attr.aria-label]="'View prescription ' + detail.prescription.id"
                >
                  View details
                </a>
              </article>
            } @empty {
              <p>No prescriptions are available for this patient.</p>
            }
          </div>

          <div class="actions">
            <button type="button" [disabled]="page() <= 1" (click)="changePage(-1)">
              Previous
            </button>
            <span>Page {{ page() }}</span>
            <button type="button" [disabled]="page() * pageSize >= total()" (click)="changePage(1)">
              Next
            </button>
          </div>
        </section>
      }
    </section>
  `,
  styleUrl: './prescription-list.scss',
})
export class PrescriptionLiveList {
  private readonly api = inject(PrescriptionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly destroyRef = inject(DestroyRef);

  private requestNumber = 0;

  readonly patientId = signal('');
  readonly consultationId = signal('');
  readonly prescriptions = signal<PrescriptionDetailResponse[]>([]);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly total = signal(0);
  readonly state = signal<'ready' | 'loading' | 'error' | 'denied'>('ready');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.patientId.set(params.get('patientId')?.trim() ?? '');
      this.consultationId.set(params.get('consultationId')?.trim() ?? '');
      this.page.set(1);
    });

    effect(() => {
      const patientId = this.patientId();
      const page = this.page();
      const role = this.roles.activeRole();

      void this.load(patientId, page, role === 'Doctor');
    });

    this.destroyRef.onDestroy(() => {
      this.requestNumber++;
    });
  }

  reload(): void {
    void this.load(this.patientId(), this.page(), this.roles.activeRole() === 'Doctor');
  }

  changePage(direction: -1 | 1): void {
    const nextPage = this.page() + direction;

    if (nextPage < 1 || (direction === 1 && this.page() * this.pageSize >= this.total())) {
      return;
    }

    this.page.set(nextPage);
  }

  private async load(patientId: string, page: number, permitted: boolean): Promise<void> {
    const requestNumber = ++this.requestNumber;

    this.prescriptions.set([]);
    this.total.set(0);

    if (!permitted) {
      this.state.set('denied');
      return;
    }

    if (!patientId) {
      this.state.set('ready');
      return;
    }

    this.state.set('loading');

    try {
      const result = await this.api.list(patientId, page, this.pageSize);

      if (requestNumber !== this.requestNumber) return;

      this.prescriptions.set(result.items);
      this.total.set(result.total);
      this.state.set('ready');
    } catch (error) {
      if (requestNumber !== this.requestNumber) return;

      const denied =
        error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);

      this.state.set(denied ? 'denied' : 'error');
    }
  }
}
