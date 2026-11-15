import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PatientMeasurements } from './patient-measurements';
import { MeasurementStore } from '../../services/measurement-store';

describe('PatientMeasurements preview isolation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientMeasurements],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    }).compileComponents();
  });

  it('starts with a fresh store when the page is reopened', () => {
    const firstPage = TestBed.createComponent(PatientMeasurements);
    const firstStore = firstPage.debugElement.injector.get(MeasurementStore);
    const initialCount = firstStore.history().length;

    const added = firstStore.add({
      recordedAt: '2026-10-20T04:00:00Z',
      source: 'patient',
      reading: { kind: 'weight', value: 72, unit: 'kg' },
    });

    expect(firstStore.history().length).toBe(initialCount + 1);

    firstPage.destroy();

    const secondPage = TestBed.createComponent(PatientMeasurements);
    const secondStore = secondPage.debugElement.injector.get(MeasurementStore);

    expect(secondStore).not.toBe(firstStore);
    expect(secondStore.history().length).toBe(initialCount);
    expect(secondStore.history().some((item) => item.id === added.id)).toBe(false);

    secondPage.destroy();
  });
  it('shows actual counts when ready', () => {
    const fixture = TestBed.createComponent(PatientMeasurements);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelectorAll(
      '.summary-card strong',
    ) as NodeListOf<HTMLElement>;

    expect(counts[0].textContent?.trim()).toBe(String(component.measurements().length));
    expect(counts[1].textContent?.trim()).toBe(
      String(component.measurements().filter((item) => item.source === 'patient').length),
    );

    fixture.destroy();
  });

  it('shows zero counts and no records in the empty preview', () => {
    const fixture = TestBed.createComponent(PatientMeasurements);
    const component = fixture.componentInstance;

    component.pageState.set('empty');
    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelectorAll(
      '.summary-card strong',
    ) as NodeListOf<HTMLElement>;

    expect(counts[0].textContent?.trim()).toBe('0');
    expect(counts[1].textContent?.trim()).toBe('0');
    expect(fixture.nativeElement.textContent).toContain('No measurements yet');
    expect(fixture.nativeElement.querySelector('app-measurement-list')).toBeNull();

    fixture.destroy();
  });

  it('marks counts unavailable while loading', () => {
    const fixture = TestBed.createComponent(PatientMeasurements);
    const component = fixture.componentInstance;

    component.pageState.set('loading');
    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelectorAll(
      '.summary-card strong',
    ) as NodeListOf<HTMLElement>;

    expect(counts[0].textContent?.trim()).toBe('Unavailable');
    expect(counts[1].textContent?.trim()).toBe('Unavailable');
    expect(fixture.nativeElement.textContent).toContain('Loading measurements');
    expect(fixture.nativeElement.querySelector('app-measurement-list')).toBeNull();

    fixture.destroy();
  });

  it('marks counts unavailable on error and restores them after retry', () => {
    const fixture = TestBed.createComponent(PatientMeasurements);
    const component = fixture.componentInstance;
    const initialCount = component.measurements().length;

    component.pageState.set('error');
    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelectorAll(
      '.summary-card strong',
    ) as NodeListOf<HTMLElement>;

    expect(counts[0].textContent?.trim()).toBe('Unavailable');
    expect(counts[1].textContent?.trim()).toBe('Unavailable');
    expect(fixture.nativeElement.textContent).toContain('Measurements unavailable');

    const retryButton = fixture.nativeElement.querySelector(
      'app-ui-state button',
    ) as HTMLButtonElement;

    expect(retryButton).not.toBeNull();
    retryButton.click();
    fixture.detectChanges();

    expect(component.pageState()).toBe('ready');
    expect(counts[0].textContent?.trim()).toBe(String(initialCount));
    expect(counts[1].textContent?.trim()).toBe(
      String(component.measurements().filter((item) => item.source === 'patient').length),
    );
    expect(fixture.nativeElement.querySelector('app-measurement-list')).not.toBeNull();

    fixture.destroy();
  });
});
