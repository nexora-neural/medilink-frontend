import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { IssueReview, issueProblems } from './prescription-issue.models';
import { PRESCRIPTION_ISSUE } from './prescription-issue.store';

@Component({
  selector: 'app-prescription-issue',
  standalone: true,
  imports: [A11yModule, RouterLink],
  templateUrl: './prescription-issue.html',
  styleUrl: './prescription-issue.scss',
})
export class PrescriptionIssue {
  private readonly port = inject(PRESCRIPTION_ISSUE);
  private readonly route = inject(ActivatedRoute);
  private readonly roles = inject(ActiveRoleService);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;
  private destroyed = false;
  private readonly panel = viewChild<ElementRef<HTMLElement>>('confirmPanel');
  private opener: HTMLElement | null = null;
  readonly permitted = computed(
    () => this.roles.activeRole() === 'Doctor' && this.roles.roles().includes('Doctor'),
  );
  readonly state = signal<'loading' | 'ready' | 'empty' | 'error' | 'denied'>('loading');
  readonly review = signal<IssueReview | null>(null);
  readonly reviewedItems = signal<string[]>([]);
  readonly acknowledged = signal(false);
  readonly dialog = signal(false);
  readonly saving = signal(false);
  readonly actionError = signal('');
  readonly message = signal('');
  statusLabel(status: IssueReview['status']): string {
    return `${status.charAt(0).toUpperCase()}${status.slice(1)} · sample`;
  }
  readonly problems = computed(() => (this.review() ? issueProblems(this.review()!) : []));
  readonly reviewedAll = computed(
    () =>
      !!this.review()?.items.length &&
      this.review()!.items.every((item) => this.reviewedItems().includes(item.id)),
  );
  readonly canIssue = computed(
    () =>
      this.permitted() &&
      this.state() === 'ready' &&
      this.review()?.status === 'draft' &&
      !this.problems().length &&
      this.reviewedAll() &&
      this.acknowledged() &&
      !this.saving(),
  );

  constructor() {
    afterRenderEffect(() => {
      this.dialog();
      const selector = this.actionError() ? '[role="alert"]' : 'h2';
      this.panel()?.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.request++;
    });
    effect(() => {
      if (!this.permitted()) {
        this.request++;
        this.review.set(null);
        this.dialog.set(false);
        this.resetReview();
        this.message.set('');
        this.actionError.set('');
        this.state.set('denied');
      }
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.load();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.load();
    });
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.resetReview();
    this.review.set(null);
    this.dialog.set(false);
    this.actionError.set('');
    this.message.set('');
    if (!this.permitted()) {
      this.state.set('denied');
      return;
    }
    this.state.set('loading');
    const preview = this.route.snapshot.queryParamMap.get('preview');
    // Explicit synthetic QA scenarios; never use query parameters as real permissions.
    if (preview === 'loading') return;
    try {
      if (preview === 'error') throw new Error('Preview failure');
      let result = await this.port.load(this.route.snapshot.paramMap.get('id') ?? 'sample-order');
      if (!this.current(request)) return;
      if (preview === 'empty') result = null;
      if (result) {
        if (preview === 'unverified') result.verifiedDoctor = false;
        if (preview === 'denied') result.consultationPermitted = false;
        if (preview === 'invalid') result.items[0].quantity = 0;
      }
      this.review.set(result);
      this.state.set(result ? 'ready' : 'empty');
    } catch {
      if (this.current(request)) this.state.set('error');
    }
  }

  markItem(id: string, checked: boolean): void {
    if (this.saving() || this.review()?.status !== 'draft') return;
    this.reviewedItems.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id),
    );
  }
  openConfirmation(): void {
    if (!this.canIssue()) return;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.actionError.set('');
    this.dialog.set(true);
  }
  closeConfirmation(): void {
    if (this.saving()) return;
    this.dialog.set(false);
    this.actionError.set('');
    this.opener?.focus();
  }
  async confirmIssue(): Promise<void> {
    if (!this.dialog() || !this.canIssue()) return;
    const request = this.request;
    const id = this.review()!.id;
    this.saving.set(true);
    this.actionError.set('');
    try {
      if (this.route.snapshot.queryParamMap.get('preview') === 'issue-error')
        throw new Error('Preview failure');
      const result = await this.port.issue(id);
      if (!this.current(request)) return;
      if (result.id !== id || result.source !== 'doctor' || result.status !== 'active')
        throw new Error('Invalid result');
      this.review.set(result);
      this.dialog.set(false);
      this.message.set(
        'Sample prescription is active in this preview. No clinical order was issued.',
      );
    } catch {
      if (this.current(request))
        this.actionError.set(
          'Unable to issue the sample prescription. No success has been confirmed. Try again or cancel.',
        );
    } finally {
      this.saving.set(false);
      if (this.current(request) && !this.dialog()) this.opener?.focus();
    }
  }
  private current(request: number): boolean {
    return !this.destroyed && request === this.request && this.permitted();
  }
  private resetReview(): void {
    this.reviewedItems.set([]);
    this.acknowledged.set(false);
  }
}
