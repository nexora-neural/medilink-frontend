import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import {
  ProfessionalApplication,
  ProfessionalApplicationsService,
} from './professional-applications.service';

@Component({
  selector: 'app-professional-applications',
  imports: [RouterLink, UiState],
  templateUrl: './professional-applications.html',
  styleUrl: './professional-applications.scss',
})
export class ProfessionalApplications implements OnInit {
  private readonly service = inject(ProfessionalApplicationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly applications = signal<readonly ProfessionalApplication[]>([]);
  protected readonly query = signal('');
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly visibleApplications = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.applications().filter((item) =>
      [item.name, item.id, item.role, item.organization].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  });

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (applications) => {
          this.applications.set(applications);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
