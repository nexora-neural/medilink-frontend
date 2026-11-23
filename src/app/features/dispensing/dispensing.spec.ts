import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Dispensing } from './dispensing';
import { DispensingStore } from './dispensing.store';

describe('Dispensing preview workflow', () => {
  it('renders prescription, validates, records and reverses a partial supply', async () => {
    await TestBed.configureTestingModule({
      imports: [Dispensing],
      providers: [provideRouter([]), DispensingStore],
    }).compileComponents();
    const fixture = TestBed.createComponent(Dispensing);
    const component = fixture.componentInstance;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    const text = () => fixture.nativeElement.textContent as string;
    expect(text()).toContain('Sample data only');
    expect(text()).toContain('30 tablets remaining');
    component.go('dispense');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(
      fixture.nativeElement.querySelector('input[aria-label="Quantity for Amlodipine (tablets)"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('input[aria-label="Quantity for Metformin (tablets)"]'),
    ).not.toBeNull();
    component.review();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'positive quantity',
    );
    component.store.quantities = [10, 0];
    component.review();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(text()).toContain('Partial');
    component.save();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(text()).toContain('20 tablets');
    expect(text()).toContain('Recorded');
    component.selectReversal(component.store.events[0].id);
    component.reverse();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(text()).toContain('Enter a reason');
    component.reason = 'Recorded in error';
    component.correctionQuantity = 0;
    component.reviewCorrection();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(text()).toContain('Confirm correction?');
    component.reverse();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(text()).toContain('Recorded in error');
    expect(text()).toContain('30 tablets');
    fixture.destroy();
  });
  it('renders loading, empty and error states', async () => {
    await TestBed.configureTestingModule({
      imports: [Dispensing],
      providers: [provideRouter([]), DispensingStore],
    }).compileComponents();
    const fixture = TestBed.createComponent(Dispensing);
    fixture.detectChanges(false);
    await fixture.whenStable();
    for (const [state, expected] of [
      ['loading', 'Loading prescription'],
      ['empty', 'No prescription available'],
      ['error', 'Unable to load prescription'],
    ] as const) {
      fixture.componentInstance.state = state;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges(false);
      expect(fixture.nativeElement.textContent).toContain(expected);
    }
    fixture.destroy();
  });
  it('loads, shows errors, retries and shows an empty result', async () => {
    await TestBed.configureTestingModule({
      imports: [Dispensing],
      providers: [provideRouter([]), DispensingStore],
    }).compileComponents();
    const store = TestBed.inject(DispensingStore);
    const load = vi
      .spyOn(store, 'load')
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(store.items);
    const fixture = TestBed.createComponent(Dispensing);
    fixture.detectChanges(false);
    expect(fixture.componentInstance.state).toBe('loading');
    await fixture.whenStable();
    expect(fixture.componentInstance.state).toBe('error');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.state).toBe('empty');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.state).toBe('ready');
    expect(load).toHaveBeenCalledTimes(3);
    fixture.destroy();
  });
});
