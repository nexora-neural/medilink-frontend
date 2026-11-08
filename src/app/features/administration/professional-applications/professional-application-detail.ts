import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, skip, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import {
  ApplicationDecision,
  applicationDecisions,
  canReview,
  ProfessionalApplication,
  ProfessionalApplicationsService,
} from './professional-applications.service';

@Component({
  selector: 'app-professional-application-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, UiState],
  templateUrl: './professional-application-detail.html',
  styleUrl: './professional-application-detail.scss',
})
export class ProfessionalApplicationDetail implements OnInit {
  private readonly service = inject(ProfessionalApplicationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly retry = new Subject<void>();
  protected readonly decisions = applicationDecisions;
  protected readonly canReview = canReview;
  protected readonly application = signal<ProfessionalApplication | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly saved = signal(false);
  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup({
    decision: new FormControl<ApplicationDecision | ''>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(1000),
        Validators.pattern(/[\s\S]*\S[\s\S]*/),
      ],
    }),
  });

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.retry.pipe(
            startWith(undefined),
            switchMap(() => {
              this.state.set('loading');
              this.application.set(null);
              this.form.reset();
              this.submitted.set(false);
              this.saveError.set(false);
              this.saved.set(false);
              this.saving.set(false);
              return this.service.get(params.get('id') ?? '').pipe(
                map((application) => ({ state: 'ready' as const, application })),
                catchError(() => of({ state: 'error' as const, application: null })),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ state, application }) => {
        this.application.set(application);
        this.state.set(state);
      });
  }

  protected load(): void {
    this.retry.next();
  }

  protected submit(): void {
    const application = this.application();
    if (!application || !canReview(application.status) || this.saving()) return;

    this.submitted.set(true);
    this.saveError.set(false);
    const { decision, reason } = this.form.getRawValue();
    if (this.form.invalid || !decision) return;

    this.saving.set(true);
    this.service
      .recordDecision(application.id, decision, reason)
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.application.set(updated);
          this.saving.set(false);
          this.saved.set(true);
          this.heading().nativeElement.focus();
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set(true);
        },
      });
  }
}
