import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ClinicalCorrections } from './clinical-corrections';

describe('ClinicalCorrections', () => {
  let component: ClinicalCorrections;
  let fixture: ComponentFixture<ClinicalCorrections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClinicalCorrections],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { mode: 'request' } } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClinicalCorrections);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows validation for an empty request', () => {
    component.submit();
    fixture.detectChanges();
    expect(component.isValid).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Enter an ID.');
  });

  it('does not claim that a request was saved', () => {
    component.recordId = 'record-1';
    component.details = 'Incorrect information';
    component.reason = 'Please review';
    component.submit();
    expect(component.isValid).toBe(true);
    expect(component.error).toContain('not been saved');
  });
});
