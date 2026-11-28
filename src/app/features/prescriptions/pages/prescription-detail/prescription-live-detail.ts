import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PrescriptionDetailResponse } from '../../models/prescription-api.model';
import { PrescriptionApiService } from '../../services/prescription-api.service';

@Component({
  selector: 'app-prescription-live-detail',
  standalone: true,
  imports: [DatePipe, RouterLink],
  styleUrl: '../prescription-list/prescription-list.scss',
  template: `
    <section class="prescription-page" aria-labelledby="live-detail-heading">
      <header>
        <p class="eyebrow">Doctor workspace</p>
        <h1 id="live-detail-heading">Prescription details</h1>
        <a
          routerLink="/workspace/doctor/prescriptions"
          [queryParams]="
            detail()
              ? {
                  patientId: detail()!.prescription.patient_user_id,
                  consultationId: detail()!.prescription.consultation_id,
                }
              : null
          "
        >
          Back to prescriptions
        </a>
      </header>

      @if (state() === 'denied') {
        <section class="panel" role="alert">
          <h2>Access unavailable</h2>
          <p>You do not currently have access to this prescription.</p>
        </section>
      } @else if (state() === 'loading') {
        <section class="panel" role="status">
          <h2>Loading prescription</h2>
          <p>Please wait while the details load.</p>
        </section>
      } @else if (state() === 'missing') {
        <section class="panel">
          <h2>Prescription unavailable</h2>
          <p>No prescription was found for this reference.</p>
        </section>
      } @else if (state() === 'error') {
        <section class="panel" role="alert">
          <h2>Unable to load prescription</h2>
          <p>Please try again.</p>
          <button type="button" (click)="reload()">Try again</button>
        </section>
      } @else if (detail(); as result) {
        <section class="panel">
          <div class="card-heading">
            <h2>Prescription</h2>
            <span class="badge">{{ result.prescription.status }}</span>
          </div>

          <dl>
            <div>
              <dt>Patient reference</dt>
              <dd>{{ result.prescription.patient_user_id }}</dd>
            </div>
            <div>
              <dt>Prescription ID</dt>
              <dd>{{ result.prescription.id }}</dd>
            </div>
            <div>
              <dt>Consultation reference</dt>
              <dd>{{ result.prescription.consultation_id ?? 'Not supplied' }}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{{ result.prescription.source }}</dd>
            </div>
            <div>
              <dt>Starts on</dt>
              <dd>
                {{ (result.prescription.starts_on | date: 'mediumDate') ?? 'Not supplied' }}
              </dd>
            </div>
            <div>
              <dt>Ends on</dt>
              <dd>
                {{ (result.prescription.ends_on | date: 'mediumDate') ?? 'Not supplied' }}
              </dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{{ result.prescription.version }}</dd>
            </div>
            <div>
              <dt>Review status</dt>
              <dd>{{ result.prescription.review_status }}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{{ result.prescription.created_at | date: 'medium' }}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{{ result.prescription.updated_at | date: 'medium' }}</dd>
            </div>
          </dl>

          @if (
            result.prescription.status === 'draft' &&
            result.prescription.source === 'doctor' &&
            result.prescription.issued_at === null
          ) {
            <div class="actions">
              <a [routerLink]="['/workspace/doctor/prescriptions', result.prescription.id, 'edit']">
                Open draft editor
              </a>
            </div>
          }

          @if (result.prescription.previous_prescription_id; as previousId) {
            <a [routerLink]="['/workspace/doctor/prescriptions', previousId]">
              View previous prescription
            </a>
          }
        </section>

        <section class="panel" aria-labelledby="live-medicines-heading">
          <h2 id="live-medicines-heading">Medicines</h2>

          <div class="prescription-list">
            @for (item of result.items; track item.id) {
              <article class="prescription-card">
                <h3>{{ $index + 1 }}. {{ item.medicine_name_snapshot }}</h3>

                <dl>
                  <div>
                    <dt>Dose</dt>
                    <dd>{{ item.dose_text }}</dd>
                  </div>
                  <div>
                    <dt>Route</dt>
                    <dd>{{ item.route ?? 'Not supplied' }}</dd>
                  </div>
                  <div>
                    <dt>Frequency</dt>
                    <dd>{{ item.frequency }}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      @if (item.duration_days !== null) {
                        {{ item.duration_days }} day(s)
                      } @else {
                        Not supplied
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd>
                      @if (item.quantity !== null) {
                        {{ item.quantity }} {{ item.quantity_unit }}
                      } @else {
                        Not supplied
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>As needed (PRN)</dt>
                    <dd>{{ item.is_prn ? 'Yes' : 'No' }}</dd>
                  </div>
                  <div>
                    <dt>Instructions</dt>
                    <dd>{{ item.instructions ?? 'No additional instructions.' }}</dd>
                  </div>
                </dl>
              </article>
            } @empty {
              <p>No medicine items are available.</p>
            }
          </div>
        </section>

        <section class="panel" aria-labelledby="live-reviews-heading">
          <h2 id="live-reviews-heading">Reviews</h2>

          @for (review of result.reviews; track review.id) {
            <article class="prescription-card">
              <h3>{{ review.outcome }}</h3>
              <p>{{ review.notes ?? 'No additional notes.' }}</p>
              <p>Reviewed: {{ review.reviewed_at | date: 'medium' }}</p>
              <p>Reviewer reference: {{ review.reviewer_user_id }}</p>
            </article>
          } @empty {
            <p>No reviews have been recorded.</p>
          }
        </section>
      }
    </section>
  `,
})
export class PrescriptionLiveDetail {
  private readonly api = inject(PrescriptionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly prescriptionId = signal('');
  private requestNumber = 0;

  readonly detail = signal<PrescriptionDetailResponse | null>(null);
  readonly state = signal<'loading' | 'ready' | 'missing' | 'denied' | 'error'>('loading');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.prescriptionId.set(params.get('id') ?? '');
    });

    effect(() => {
      const id = this.prescriptionId();
      const permitted = this.roles.activeRole() === 'Doctor';

      void this.load(id, permitted);
    });

    this.destroyRef.onDestroy(() => {
      this.requestNumber++;
    });
  }

  reload(): void {
    void this.load(this.prescriptionId(), this.roles.activeRole() === 'Doctor');
  }

  private async load(id: string, permitted: boolean): Promise<void> {
    const requestNumber = ++this.requestNumber;

    this.detail.set(null);

    if (!permitted) {
      this.state.set('denied');
      return;
    }

    if (!id) {
      this.state.set('missing');
      return;
    }

    this.state.set('loading');

    try {
      const detail = await this.api.get(id);

      if (requestNumber !== this.requestNumber) return;

      this.detail.set(detail);
      this.state.set('ready');
    } catch (error) {
      if (requestNumber !== this.requestNumber) return;

      const status = error instanceof HttpErrorResponse ? error.status : 0;

      this.state.set(
        status === 401 || status === 403 ? 'denied' : status === 404 ? 'missing' : 'error',
      );
    }
  }
}
