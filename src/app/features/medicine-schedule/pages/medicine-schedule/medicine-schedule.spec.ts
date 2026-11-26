import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MedicineSchedule } from './medicine-schedule';
import { MedicineScheduleStore } from '../../services/medicine-schedule.store';

describe('MedicineSchedule', () => {
  let fixture: ComponentFixture<MedicineSchedule>;
  let component: MedicineSchedule;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicineSchedule],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicineSchedule);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('creates the medicine schedule page', async () => {
    await render();

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Medicine schedule');
  });

  it('loads the sample medicine schedules', async () => {
    await render();

    expect(component.schedules()).toHaveLength(2);
    expect(component.activeCount()).toBe(2);
    expect(component.pausedCount()).toBe(0);
    expect(component.totalDoses()).toBe(2);
  });

  it('uses the Asia/Colombo timezone', async () => {
    await render();

    expect(component.timezone).toBe('Asia/Colombo');
    expect(component.selectedDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('confirms an active medicine schedule', async () => {
    await render();

    component.confirmSchedule('medicine-001');

    expect(component.isScheduleConfirmed('medicine-001')).toBe(true);
    expect(component.message()).toContain('confirmation recorded');
    expect(component.error()).toBe('');
  });

  it('shows an error when an unknown schedule is confirmed', async () => {
    await render();

    component.confirmSchedule('unknown');

    expect(component.error()).toContain('Unable to confirm');
    expect(component.message()).toBe('');
  });

  it('pauses a medicine schedule', async () => {
    await render();

    component.pause('medicine-001');

    expect(component.schedules()[0]?.status).toBe('paused');
    expect(component.pausedCount()).toBe(1);
    expect(component.activeCount()).toBe(1);
    expect(component.message()).toContain('paused');
  });

  it('resumes a paused medicine schedule', async () => {
    await render();

    component.pause('medicine-001');
    component.resume('medicine-001');

    expect(component.schedules()[0]?.status).toBe('active');
    expect(component.pausedCount()).toBe(0);
    expect(component.activeCount()).toBe(2);
    expect(component.message()).toContain('resumed');
  });

  it('replaces a dose time', async () => {
    await render();

    component.replaceTime('medicine-001', 'dose-001', '09:30');

    expect(component.schedules()[0]?.doseTimes[0]?.time).toBe('09:30');
    expect(component.message()).toContain('Dose time updated');
    expect(component.error()).toBe('');
  });

  it('shows validation when the replacement time is empty', async () => {
    await render();

    component.replaceTime('medicine-001', 'dose-001', '');

    expect(component.error()).toContain('Please select a valid dose time');
    expect(component.message()).toBe('');
  });

  it('shows an error when a replacement time is invalid', async () => {
    await render();

    component.replaceTime('medicine-001', 'dose-001', '25:90');

    expect(component.error()).toContain('Unable to replace');
    expect(component.schedules()[0]?.doseTimes[0]?.time).toBe('08:00');
  });

  it('reports a dose as taken', async () => {
    await render();

    component.reportDose('occurrence-001', 'taken');

    expect(component.occurrences()[0]?.status).toBe('taken');
    expect(component.takenCount()).toBe(1);
    expect(component.message()).toContain('patient-reported entry');
    expect(component.error()).toBe('');
  });

  it('reports a dose as skipped', async () => {
    await render();

    component.reportDose('occurrence-001', 'skipped');

    expect(component.occurrences()[0]?.status).toBe('skipped');
    expect(component.skippedCount()).toBe(1);
    expect(component.message()).toContain('reported as skipped');
  });

  it('shows an error when an unknown dose is reported', async () => {
    await render();

    component.reportDose('unknown', 'taken');

    expect(component.error()).toContain('Unable to update this dose report');
    expect(component.message()).toBe('');
  });

  it('snoozes a dose reminder', async () => {
    await render();

    component.snoozeOccurrence('occurrence-002');

    expect(component.occurrences()[1]?.reminderSnoozedUntil).not.toBeNull();
    expect(component.message()).toContain('snoozed for 10 minutes');
    expect(component.error()).toBe('');
  });

  it('changes the selected date and clears messages', async () => {
    await render();

    component.confirmSchedule('medicine-001');

    const event = {
      target: { value: '2026-11-27' },
    } as unknown as Event;

    component.changeDate(event);

    expect(component.selectedDate()).toBe('2026-11-27');
    expect(component.message()).toBe('');
    expect(component.error()).toBe('');
  });

  it('does not change the selected date when the input is empty', async () => {
    await render();

    const previousDate = component.selectedDate();

    const event = {
      target: { value: '' },
    } as unknown as Event;

    component.changeDate(event);

    expect(component.selectedDate()).toBe(previousDate);
  });

  it('shows the ready state when retry is called with schedules', async () => {
    await render();

    component.pageState.set('error');
    component.retry();

    expect(component.pageState()).toBe('ready');
    expect(component.error()).toBe('');
  });

  it('uses the empty state when retry is called without schedules', async () => {
    await render();

    const store = fixture.debugElement.injector.get(MedicineScheduleStore);

    store['schedulesState'].set([]);
    component.pageState.set('error');

    component.retry();

    expect(component.pageState()).toBe('empty');
    expect(component.error()).toBe('');
  });
});
