import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DoctorPatientQueue } from './doctor-patient-queue';

describe('DoctorPatientQueue', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    queryParamMap.next(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [DoctorPatientQueue],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap.asObservable(),
          },
        },
      ],
    }).compileComponents();
  });

  it('shows sample patients in the default preview state', () => {
    const fixture = TestBed.createComponent(DoctorPatientQueue);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nadeesha Perera');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.errorMessage()).toBe('');
  });

  it('shows the loading state when the loading preview is selected', () => {
    queryParamMap.next(convertToParamMap({ preview: 'loading' }));

    const fixture = TestBed.createComponent(DoctorPatientQueue);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Loading patients');
  });

  it('shows the error state when the error preview is selected', () => {
    queryParamMap.next(convertToParamMap({ preview: 'error' }));

    const fixture = TestBed.createComponent(DoctorPatientQueue);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Unable to load patients');
    expect(fixture.componentInstance.errorMessage()).not.toBe('');
  });

  it('allows the error preview to be retried', () => {
    const fixture = TestBed.createComponent(DoctorPatientQueue);
    fixture.detectChanges();

    fixture.componentInstance.setPreviewState('error');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unable to load patients');

    fixture.componentInstance.retry();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage()).toBe('');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Nadeesha Perera');
  });
});
