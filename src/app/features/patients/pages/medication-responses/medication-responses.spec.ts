import { describe, expect, it } from 'vitest';
import { MedicationResponses } from './medication-responses';

describe('MedicationResponses', () => {
  it('validates the response and reported time before saving', () => {
    const component = new MedicationResponses();
    const occurrence = component.occurrences[0];
    component.start(occurrence);
    component.choice = '';
    component.save();
    expect(occurrence.versions).toHaveLength(0);
    expect(component.submitted).toBe(true);

    component.choice = 'Taken';
    component.reportedAt = '2999-01-01T12:00';
    component.save();
    expect(occurrence.versions).toHaveLength(0);
  });

  it('keeps one current response and retains previous responses after a correction', () => {
    const component = new MedicationResponses();
    const occurrence = component.occurrences[0];
    component.start(occurrence);
    component.choice = 'Taken';
    component.reportedAt = '2020-01-01T08:00';
    component.save();
    expect(component.view).toBe('history');
    expect(component.reportedCount).toBe(1);
    expect(occurrence.versions[0].reportedAt).toBe('2020-01-01T08:00');
    expect(occurrence.versions[0].enteredAt).toBeTruthy();

    component.start(occurrence);
    component.choice = 'Skipped';
    component.reason = '  ';
    component.save();
    expect(occurrence.versions).toHaveLength(1);
    component.reason = 'Correcting the response';
    component.save();
    expect(occurrence.versions).toHaveLength(2);
    expect(occurrence.versions[0].choice).toBe('Skipped');
    expect(occurrence.versions[0].reason).toBe('Correcting the response');
    expect(occurrence.versions[1].choice).toBe('Taken');
    expect(component.reportedCount).toBe(1);
  });
});
