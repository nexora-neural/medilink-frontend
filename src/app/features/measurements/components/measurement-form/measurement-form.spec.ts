import { TestBed } from '@angular/core/testing';
import { MeasurementForm } from './measurement-form';
import { MeasurementRecord } from '../../models/measurement.model';

describe('MeasurementForm switching', () => {
  const original: MeasurementRecord = {
    id: 'weight-1',
    rootId: 'weight-1',
    correctsId: null,
    recordedAt: '2026-10-20T04:00:00Z',
    createdAt: '2026-10-20T04:05:00Z',
    source: 'patient',
    reading: { kind: 'weight', value: 64, unit: 'kg' },
    correctionReason: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeasurementForm],
    }).compileComponents();
  });

  it('clears correction values when switching to Add', () => {
    const fixture = TestBed.createComponent(MeasurementForm);
    const form = fixture.componentInstance;

    fixture.componentRef.setInput('correcting', original);
    fixture.detectChanges();

    expect(form.value).toBe(64);

    form.reason = 'Old correction reason';
    form.error.set('Previous error');

    fixture.componentRef.setInput('correcting', null);
    fixture.detectChanges();

    expect(form.kind).toBe('weight');
    expect(form.value).toBeNull();
    expect(form.systolic).toBeNull();
    expect(form.diastolic).toBeNull();
    expect(form.reason).toBe('');
    expect(form.error()).toBe('');
    expect(form.recordedAt).not.toBe('');
  });

  it('loads another record and clears the previous reason and error', () => {
    const fixture = TestBed.createComponent(MeasurementForm);
    const form = fixture.componentInstance;

    fixture.componentRef.setInput('correcting', original);
    fixture.detectChanges();

    form.reason = 'Reason for the first record';
    form.error.set('Previous error');

    const bloodPressure: MeasurementRecord = {
      ...original,
      id: 'bp-1',
      rootId: 'bp-1',
      reading: {
        kind: 'blood_pressure',
        systolic: 120,
        diastolic: 78,
        unit: 'mmHg',
      },
    };

    fixture.componentRef.setInput('correcting', bloodPressure);
    fixture.detectChanges();

    expect(form.kind).toBe('blood_pressure');
    expect(form.systolic).toBe(120);
    expect(form.diastolic).toBe(78);
    expect(form.value).toBeNull();
    expect(form.reason).toBe('');
    expect(form.error()).toBe('');
  });
});
