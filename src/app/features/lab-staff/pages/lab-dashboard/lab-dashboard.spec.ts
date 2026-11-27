import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { LabDashboard } from './lab-dashboard';

describe('LabDashboard', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [LabDashboard],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: params.asObservable(),
            snapshot: { queryParamMap: params.value },
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(ActiveRoleService).setAccountRoles('sample-lab-account', ['lab_staff']);
  });

  it('shows the reference layout and links to existing laboratory workflows', () => {
    const fixture = TestBed.createComponent(LabDashboard);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Good morning, Amara');
    const notice = element.querySelector('.demo-notice');
    expect(notice?.textContent).toContain('Demo data only.');
    expect(notice?.textContent).toContain('signed-in identity');
    expect(notice?.textContent).toContain('verification or real laboratory activity');
    expect(element.querySelectorAll('.stat')).toHaveLength(4);
    expect(element.textContent).toContain('No reports uploaded yet.');
    expect(element.querySelector('.preview-tools')).toBeNull();
    expect(element.querySelector('a.primary')?.getAttribute('href')).toBe(
      '/workspace/lab-staff/upload-requests',
    );
    expect(element.querySelector('app-lab-recent-reports-panel a')?.getAttribute('href')).toBe(
      '/workspace/lab-staff/reports',
    );
  });

  it('hides dashboard fixtures when the active role changes', () => {
    const fixture = TestBed.createComponent(LabDashboard);
    fixture.detectChanges();
    TestBed.inject(ActiveRoleService).setAccountRoles('sample-patient-account', ['patient']);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Dashboard unavailable');
    expect(element.querySelector('app-lab-summary-cards')).toBeNull();
    expect(element.textContent).not.toContain('Central Laboratory');
  });

  it('supports loading, error, retry destination and empty previews', () => {
    const fixture = TestBed.createComponent(LabDashboard);

    params.next(convertToParamMap({ preview: 'loading' }));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.textContent).toContain('Loading laboratory dashboard');
    expect(element.querySelector('app-lab-summary-cards')).toBeNull();

    params.next(convertToParamMap({ preview: 'error' }));
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load dashboard',
    );
    expect(element.querySelector('a.secondary')?.getAttribute('href')).toContain('preview=ready');

    params.next(convertToParamMap({ preview: 'ready' }));
    fixture.detectChanges();
    expect(element.querySelector('app-lab-summary-cards')).not.toBeNull();

    params.next(convertToParamMap({ preview: 'empty' }));
    fixture.detectChanges();
    expect(element.querySelector('.stat strong')?.textContent?.trim()).toBe('0');
    expect(element.textContent).toContain('No reports uploaded yet.');
  });

  it('shows a sample recent report only in its explicit preview', () => {
    const fixture = TestBed.createComponent(LabDashboard);
    params.next(convertToParamMap({ preview: 'reports' }));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Full blood count');
    expect(element.querySelector('.report-row')?.getAttribute('href')).toBe(
      '/workspace/lab-staff/reports',
    );

    params.next(convertToParamMap({ preview: 'denied' }));
    fixture.detectChanges();
    expect(element.querySelector('.report-row')).toBeNull();
    expect(element.textContent).toContain('Dashboard unavailable');
    const readyLink = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.preview-tools a'),
    ).find((link) => link.textContent?.trim() === 'ready');
    expect(readyLink?.getAttribute('href')).toContain('preview=ready');
    params.next(convertToParamMap({ preview: 'ready' }));
    fixture.detectChanges();
    expect(element.querySelector('app-lab-summary-cards')).not.toBeNull();
  });
});
