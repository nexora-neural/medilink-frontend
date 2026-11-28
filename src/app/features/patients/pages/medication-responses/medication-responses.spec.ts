import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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

describe('MedicationResponses preview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicationResponses],
    }).compileComponents();
  });

  it('opens each preview state and retries the error', () => {
    const fixture = TestBed.createComponent(MedicationResponses);
    fixture.changeDetectorRef.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    const button = (text: string) =>
      [...root.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)!;

    button('Loading').click();
    fixture.changeDetectorRef.detectChanges();

    expect(root.textContent).toContain('Loading medication responses');

    button('Empty').click();
    fixture.changeDetectorRef.detectChanges();

    expect(root.textContent).toContain('No medications scheduled');

    button('Error').click();
    fixture.changeDetectorRef.detectChanges();

    expect(root.textContent).toContain('Unable to load responses');

    button('Try again').click();
    fixture.changeDetectorRef.detectChanges();

    expect(root.textContent).toContain('Medication schedule');
  });

  it('moves focus between views and restores the originating schedule action', async () => {
    const fixture = TestBed.createComponent(MedicationResponses);

    document.body.appendChild(fixture.nativeElement);

    try {
      fixture.changeDetectorRef.detectChanges();

      const root = fixture.nativeElement as HTMLElement;

      const action = (kind: string) =>
        root.querySelector<HTMLButtonElement>(`[data-occurrence="1"][data-action="${kind}"]`)!;

      const heading = () => root.querySelector<HTMLElement>('h2[tabindex="-1"]');

      const back = () => root.querySelector<HTMLButtonElement>('button.back')!;

      // Open history and check focus.
      action('history').focus();
      action('history').click();
      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(heading());
      expect(heading()?.textContent).toContain('Response history');

      // Go back and check that focus returns to Response history.
      back().click();
      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(action('history'));

      // Open the response form and check focus.
      action('response').click();
      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(heading());
      expect(heading()?.textContent).toContain('Record response');

      // Save a response and check focus in history.
      fixture.componentInstance.choice = 'Taken';
      fixture.componentInstance.reportedAt = '2020-01-01T08:00';
      fixture.componentInstance.save();
      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(heading());
      expect(heading()?.textContent).toContain('Response history');

      // Go back and check that focus returns to the response action.
      back().click();
      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(action('response'));

      // Open the form again and cancel.
      action('response').click();
      fixture.changeDetectorRef.detectChanges();

      root
        .querySelector<HTMLButtonElement>('button.secondary[type="button"]:not([aria-pressed])')
        ?.click();

      fixture.changeDetectorRef.detectChanges();

      expect(document.activeElement).toBe(action('response'));
    } finally {
      fixture.nativeElement.remove();
    }
  });
});
