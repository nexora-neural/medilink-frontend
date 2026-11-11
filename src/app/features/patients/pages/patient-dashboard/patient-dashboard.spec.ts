import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PatientDashboard } from './patient-dashboard';

describe('PatientDashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientDashboard],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    }).compileComponents();
  });

  it('shows dashboard sections and patient workspace navigation', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Your care overview');
    expect(element.textContent).toContain('Today’s doses');
    expect(element.textContent).toContain('Weekly activity');
    expect(element.textContent).toContain('Today’s schedule');
    expect(element.textContent).toContain('Recent updates');
    expect(element.textContent).toContain('Sample preview only');
    expect(element.querySelector('a[href="/workspace/patient/prescriptions"]')).not.toBeNull();
    expect(element.querySelector('a[href="/workspace/patient/history"]')).not.toBeNull();
    expect(element.querySelector('a.update-row[href="/workspace/patient/reports"]')).not.toBeNull();
    expect(element.querySelector('a[href="/workspace/patient/access"]')).not.toBeNull();
    expect(
      element.querySelector('[aria-label="Today’s medication schedule timeline"]'),
    ).not.toBeNull();
  });

  it('positions late evening doses at their actual time on the full-day timeline', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;

    expect(dashboard.timelinePosition('9:00 PM')).toBe(87.5);
    expect(dashboard.timelinePosition('8:00 PM')).toBeCloseTo(83.333, 2);
  });

  it('shows empty messages when there are no dashboard records', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.componentInstance.setPreviewState('empty');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No medicines are scheduled for today.');
    expect(text).toContain('You do not have any recent notifications.');
  });

  it('shows loading and error states and can retry after an error', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.componentInstance.setPreviewState('loading');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading your dashboard');
    fixture.componentInstance.setPreviewState('error');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Dashboard information is unavailable',
    );
    fixture.componentInstance.retry();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Today’s schedule');
  });
});
