import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DoctorEvidenceReview } from './doctor-evidence-review';

describe('DoctorEvidenceReview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorEvidenceReview],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('requires an outcome before adding a review', () => {
    const fixture = TestBed.createComponent(DoctorEvidenceReview);

    fixture.componentInstance.saveReview();
    fixture.detectChanges();

    expect(fixture.componentInstance.reviews).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Select a review outcome');
  });

  it('shows the review outcome, sample reviewer and date without changing the source', () => {
    const fixture = TestBed.createComponent(DoctorEvidenceReview);
    const component = fixture.componentInstance;

    component.outcome = 'Reviewed';
    component.notes = 'Checked';
    component.saveReview();
    fixture.detectChanges();

    expect(component.reviews[0].date).toBeInstanceOf(Date);
    expect(fixture.nativeElement.textContent).toContain('Sample doctor');
    expect(fixture.nativeElement.textContent).toContain('Reviewed');
    expect(fixture.nativeElement.textContent).toContain('Patient-added · Not clinically verified');
  });

  it('shows loading, empty and error states and supports retry', () => {
    const fixture = TestBed.createComponent(DoctorEvidenceReview);

    fixture.componentInstance.state = 'loading';
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading evidence');

    fixture.componentInstance.state = 'empty';
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No evidence available');

    fixture.componentInstance.state = 'error';
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load evidence');

    fixture.componentInstance.retry();
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Prescription evidence');
  });
});
