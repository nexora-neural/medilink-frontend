import { Directive, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

@Directive()
export abstract class PublicPageState {
  page = 'home';
  role = 'Patient';
  roles = [
    { name: 'Patient', icon: 'person', description: 'Manage your medicines and health records.' },
    {
      name: 'Doctor',
      icon: 'stethoscope',
      description: 'Review patient records and issue prescriptions.',
    },
    {
      name: 'Pharmacist',
      icon: 'medication',
      description: 'Review and record prescription dispensing.',
    },
    { name: 'Lab Staff', icon: 'science', description: 'Share laboratory reports with patients.' },
  ];
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.page = data['page'] || 'home';
      this.onPageChanged();
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    });
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.role =
        params['role'] && this.roles.some((item) => item.name === params['role'])
          ? params['role']
          : 'Patient';
    });
  }

  protected onPageChanged(): void {}
}
