import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField } from './form-field';

describe('FormField', () => {
  let fixture: ComponentFixture<FormField>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormField] }).compileComponents();
    fixture = TestBed.createComponent(FormField);
    fixture.componentRef.setInput('fieldId', 'email');
    fixture.componentRef.setInput('label', 'Email address');
  });

  it('associates the label with the field and displays the required marker', () => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe('email');
    expect(label.querySelector('.required-mark')?.textContent).toContain('*');
  });

  it('shows hint text until an error is present, then exposes the error as an alert', () => {
    fixture.componentRef.setInput('hint', 'We will only use this for account access.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#email-hint')?.textContent).toContain('only use');

    fixture.componentRef.setInput('error', 'Enter a valid email address.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#email-hint')).toBeNull();
    const error = fixture.nativeElement.querySelector('#email-error') as HTMLElement;
    expect(error.textContent).toContain('valid email');
    expect(error.getAttribute('role')).toBe('alert');
    expect(fixture.nativeElement.querySelector('.form-field').classList).toContain('invalid');
  });
});
