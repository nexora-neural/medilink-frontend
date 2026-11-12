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
});
