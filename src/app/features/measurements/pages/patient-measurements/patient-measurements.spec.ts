import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';

import { PatientMeasurements } from './patient-measurements';
import { MeasurementStore } from '../../services/measurement-store';

import { MeasurementDraft, MeasurementRecord } from '../../models/measurement.model';

const original: MeasurementRecord = {
  id: 'measurement-1',
  rootId: 'measurement-1',
  correctsId: null,
  recordedAt: '2026-10-20T04:00:00Z',
  createdAt: '2026-10-20T04:05:00Z',
  source: 'patient',
  reading: {
    kind: 'weight',
    value: 64,
    unit: 'kg',
  },
  correctionReason: null,
};

class MockMeasurementStore {
  private readonly recordsState = signal<MeasurementRecord[]>([]);

  readonly current = this.recordsState.asReadonly();
  readonly history = this.recordsState.asReadonly();
  readonly historyUnavailable = signal(false);

  readonly patientAdded = computed(
    () => this.current().filter((record) => record.source === 'patient').length,
  );

  loadCalls = 0;
  addCalls = 0;
  correctCalls = 0;

  shouldFail = false;

  setRecords(records: MeasurementRecord[]): void {
    this.recordsState.set(records);
  }

  async load(): Promise<void> {
    this.loadCalls++;

    if (this.shouldFail) {
      throw new Error('Unable to load measurements.');
    }
  }

  async add(draft: MeasurementDraft): Promise<void> {
    this.addCalls++;

    const record: MeasurementRecord = {
      ...draft,
      id: `measurement-${this.addCalls + 1}`,
      rootId: `measurement-${this.addCalls + 1}`,
      correctsId: null,
      createdAt: new Date().toISOString(),
      correctionReason: null,
    };

    this.recordsState.update((records) => [...records, record]);
  }

  async correct(id: string, draft: MeasurementDraft, reason: string): Promise<void> {
    this.correctCalls++;

    const previous = this.current().find((record) => record.id === id);

    if (!previous) {
      throw new Error('Measurement not found.');
    }

    const corrected: MeasurementRecord = {
      ...draft,
      id: `corrected-${this.correctCalls}`,
      rootId: previous.rootId,
      correctsId: previous.id,
      createdAt: new Date().toISOString(),
      correctionReason: reason,
    };

    this.recordsState.update((records) => [
      ...records.filter((record) => record.id !== id),
      corrected,
    ]);
  }
}

describe('PatientMeasurements API integration', () => {
  let store: MockMeasurementStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientMeasurements],
    })
      .overrideComponent(PatientMeasurements, {
        set: {
          providers: [
            {
              provide: MeasurementStore,
              useClass: MockMeasurementStore,
            },
          ],
        },
      })
      .compileComponents();
  });

  function createPage() {
    const fixture = TestBed.createComponent(PatientMeasurements);

    store = fixture.debugElement.injector.get(MeasurementStore) as unknown as MockMeasurementStore;

    return fixture;
  }

  it('loads measurements when the page opens', async () => {
    const fixture = createPage();

    store.setRecords([original]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.loadCalls).toBe(1);
    expect(fixture.componentInstance.pageState()).toBe('ready');
    expect(fixture.componentInstance.measurements().length).toBe(1);

    fixture.destroy();
  });

  it('shows an empty state when no measurements exist', async () => {
    const fixture = createPage();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.pageState()).toBe('empty');
    expect(component.total()).toBe(0);
    expect(component.patientAdded()).toBe(0);

    expect(fixture.nativeElement.textContent).toContain('No measurements yet');

    fixture.destroy();
  });

  it('shows correct measurement counts', async () => {
    const fixture = createPage();

    store.setRecords([
      original,
      {
        ...original,
        id: 'measurement-2',
        rootId: 'measurement-2',
        source: 'doctor',
      },
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.total()).toBe(2);
    expect(component.patientAdded()).toBe(1);

    const counts = fixture.nativeElement.querySelectorAll(
      '.summary-card strong',
    ) as NodeListOf<HTMLElement>;

    expect(counts[0].textContent?.trim()).toBe('2');
    expect(counts[1].textContent?.trim()).toBe('1');

    fixture.destroy();
  });

  it('saves a new measurement using the store', async () => {
    const fixture = createPage();

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.add();

    const draft: MeasurementDraft = {
      recordedAt: '2026-10-20T04:00:00Z',
      source: 'patient',
      reading: {
        kind: 'weight',
        value: 65,
        unit: 'kg',
      },
    };

    await component.save({
      draft,
      reason: '',
    });

    expect(store.addCalls).toBe(1);
    expect(component.measurements().length).toBe(1);
    expect(component.pageState()).toBe('ready');
    expect(component.formMode()).toBeNull();

    expect(component.message()).toBe('Measurement added successfully.');

    fixture.destroy();
  });

  it('corrects a patient measurement', async () => {
    const fixture = createPage();

    store.setRecords([original]);

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.correct(original);

    const draft: MeasurementDraft = {
      recordedAt: original.recordedAt,
      source: 'patient',
      reading: {
        kind: 'weight',
        value: 66,
        unit: 'kg',
      },
    };

    await component.save({
      draft,
      reason: 'Corrected entered weight',
    });

    expect(store.correctCalls).toBe(1);

    const corrected = component.measurements()[0];

    expect(corrected.correctsId).toBe(original.id);
    expect(corrected.correctionReason).toBe('Corrected entered weight');

    expect(component.formMode()).toBeNull();

    fixture.destroy();
  });

  it('prevents correction of doctor records', async () => {
    const fixture = createPage();

    const doctorRecord: MeasurementRecord = {
      ...original,
      id: 'doctor-measurement',
      source: 'doctor',
    };

    store.setRecords([doctorRecord]);

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.correct(doctorRecord);

    expect(component.formMode()).toBeNull();
    expect(component.correcting()).toBeNull();

    fixture.destroy();
  });

  it('shows an error when measurement loading fails', async () => {
    const fixture = createPage();

    store.shouldFail = true;

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.pageState()).toBe('error');
    expect(component.total()).toBeNull();
    expect(component.patientAdded()).toBeNull();

    expect(fixture.nativeElement.textContent).toContain('Measurements unavailable');

    fixture.destroy();
  });

  it('retries loading after an API error', async () => {
    const fixture = createPage();

    store.shouldFail = true;

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(component.pageState()).toBe('error');

    store.shouldFail = false;
    store.setRecords([original]);

    await component.retry();

    fixture.detectChanges();

    expect(store.loadCalls).toBe(2);
    expect(component.pageState()).toBe('ready');
    expect(component.measurements().length).toBe(1);

    fixture.destroy();
  });

  it('toggles correction history visibility', async () => {
    const fixture = createPage();

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(component.showHistory()).toBe(false);

    component.toggleHistory();

    expect(component.showHistory()).toBe(true);

    component.clearHistory();

    expect(component.showHistory()).toBe(false);

    fixture.destroy();
  });
});
