import {
  afterEveryRender,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DispensingStore } from './dispensing.store';

type Page = 'prescription' | 'dispense' | 'confirm' | 'history' | 'reversal';
@Component({
  selector: 'app-dispensing',
  imports: [FormsModule, RouterLink],
  templateUrl: './dispensing.html',
  styleUrl: './dispensing.scss',
})
export class Dispensing implements OnInit {
  readonly store = inject(DispensingStore);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private focusHeading = false;
  constructor() {
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      const pages: Page[] = ['prescription', 'dispense', 'confirm', 'history', 'reversal'];
      let page = pages.find((item) => item === fragment) ?? 'prescription';
      if (page === 'confirm' && this.store.validate()) {
        page = 'dispense';
        void this.router.navigate([], {
          relativeTo: this.route,
          fragment: 'dispense',
          replaceUrl: true,
        });
      }
      if (this.page !== page) {
        this.page = page;
        this.error = '';
        this.message = '';
        this.focusHeading = true;
        this.changeDetector.markForCheck();
      }
    });
    afterEveryRender(() => {
      if (this.focusHeading) {
        this.focusHeading = false;
        (this.element.nativeElement.querySelector('h1') as HTMLElement | null)?.focus();
      }
    });
  }
  page: Page = 'prescription';
  state: 'ready' | 'loading' | 'error' | 'empty' = 'loading';
  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    this.state = 'loading';
    try {
      this.state = (await this.store.load()).length ? 'ready' : 'empty';
    } catch {
      this.state = 'error';
    }
    this.changeDetector.markForCheck();
  }
  error = '';
  message = '';
  reason = '';
  selectedId = 0;
  correctionQuantity = 0;
  confirming = false;
  go(page: Page): void {
    this.page = page;
    this.error = '';
    this.message = '';
    this.focusHeading = true;
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: page === 'prescription' ? undefined : page,
    });
  }
  review(): void {
    this.error = this.store.validate();
    if (!this.error) this.go('confirm');
  }
  save(): void {
    const error = this.store.save();
    if (error) {
      this.go('dispense');
      this.error = error;
      return;
    }
    this.go('history');
    this.message = 'Dispensing recorded for this preview session.';
  }
  selectReversal(id: number): void {
    this.selectedId = id;
    this.reason = '';
    this.correctionQuantity = this.store.events.find((e) => e.id === id)?.quantity ?? 0;
    this.confirming = false;
    this.go('reversal');
  }
  reviewCorrection(): void {
    this.error = this.store.validateCorrection(
      this.selectedId,
      this.correctionQuantity,
      this.reason,
    );
    if (this.error) return;
    this.confirming = true;
  }
  reverse(): void {
    this.error = this.store.correct(this.selectedId, this.correctionQuantity, this.reason);
    if (!this.error) {
      this.go('history');
      this.message = 'Correction recorded for this preview session.';
    }
  }
  get selected() {
    return this.store.events.find(
      (e) => e.id === this.selectedId && (e.status === 'Recorded' || e.status === 'Correction'),
    );
  }
}
