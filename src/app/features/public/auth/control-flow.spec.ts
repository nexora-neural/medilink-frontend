import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccessFormComponent } from './components/access-form/access-form';
import { ProfessionalRolesComponent } from './components/professional-roles/professional-roles';
import { AuthService } from '../../../core/auth.service';
import { RegistrationComponent } from './components/registration/registration';

describe('Public authentication control flow', () => {
  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await TestBed.configureTestingModule({
      imports: [AccessFormComponent, ProfessionalRolesComponent, RegistrationComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { data: of({ page: 'login' }), queryParams: of({}) } },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(AuthService), 'registrationAvailable').mockResolvedValue({
      available: true,
      recoverable: false,
    });
  });

  it('shows the appropriate fields for login, reset and verification', async () => {
    const fixture = TestBed.createComponent(AccessFormComponent);
    fixture.componentInstance.page = 'login';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="email"]')).not.toBeNull();
    expect(element.querySelector('input[name="password"]')).not.toBeNull();
    expect(element.querySelector('input[name="code"]')).toBeNull();

    fixture.componentInstance.page = 'reset';
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('input[name="email"]')).toBeNull();
    expect(element.querySelector('input[name="confirm"]')).not.toBeNull();

    fixture.componentInstance.page = 'verify';
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('input[name="code"]')).not.toBeNull();
    expect(element.querySelector('input[name="password"]')).toBeNull();
  });

  it('shows the right registration fields as patient and professional steps change', async () => {
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentInstance.page = 'register';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="fullName"]')).not.toBeNull();
    expect(element.querySelector('input[name="professionalId"]')).toBeNull();

    fixture.componentInstance.role = 'Doctor';
    fixture.componentInstance.registerStep = 2;
    fixture.changeDetectorRef.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('input[name="professionalId"]')).not.toBeNull();
    expect(element.querySelector('input[name="fullName"]')).toBeNull();

    fixture.componentInstance.registerStep = 3;
    fixture.changeDetectorRef.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('input[name="password"]')).not.toBeNull();
    expect(element.querySelector('input[name="professionalId"]')).toBeNull();
  });

  it('renders each professional role as a registration link', () => {
    const fixture = TestBed.createComponent(ProfessionalRolesComponent);
    fixture.componentInstance.page = 'roles';
    fixture.componentInstance.roles = ['Doctor', 'Pharmacist', 'Lab Staff'].map((name) => ({
      name,
      icon: '',
      description: '',
    }));
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll(
      '.role-list a',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links, (link) => link.textContent)).toEqual([
      expect.stringContaining('Doctor'),
      expect.stringContaining('Pharmacist'),
      expect.stringContaining('Lab Staff'),
    ]);
  });
  it('prevents invalid registration and advances only after valid details are entered', async () => {
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentInstance.page = 'register';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.registerStep).toBe(1);
    expect(element.textContent).toContain('Please enter your name.');

    for (const [name, value] of [
      ['fullName', 'Example User'],
      ['email', 'person@example.com'],
      ['phone', '0771234567'],
    ]) {
      const input = element.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const dateInput = element.querySelector('input[name="dateOfBirth"]') as HTMLInputElement;
    dateInput.value = '2000-01-01';
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    const sexInput = element.querySelector('select[name="sex"]') as HTMLSelectElement;
    sexInput.value = 'female';
    sexInput.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.registerStep).toBe(2));
    fixture.detectChanges();
    expect(element.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('limits Sri Lankan phone input to nine digits after +94 and rejects extended birth years', () => {
    const component = TestBed.createComponent(RegistrationComponent).componentInstance;
    const phoneInput = document.createElement('input');
    phoneInput.value = '+9477123456789';
    component.limitPhoneInput({ target: phoneInput } as unknown as Event);
    expect(phoneInput.value).toBe('+94771234567');
    expect(component.registrationForm.controls.phone.value).toBe('+94771234567');
    expect(component.registrationForm.controls.phone.valid).toBe(true);

    component.registrationForm.controls.dateOfBirth.setValue('12000-01-01');
    expect(component.registrationForm.controls.dateOfBirth.hasError('invalidDate')).toBe(true);
    component.registrationForm.controls.dateOfBirth.setValue('2025-02-31');
    expect(component.registrationForm.controls.dateOfBirth.hasError('invalidDate')).toBe(true);
    component.registrationForm.controls.dateOfBirth.setValue('2000-01-01');
    expect(component.registrationForm.controls.dateOfBirth.valid).toBe(true);
  });

  it('reports a registered email when the field loses focus', async () => {
    vi.mocked(TestBed.inject(AuthService).registrationAvailable).mockResolvedValue({
      available: false,
      recoverable: false,
    });
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentInstance.page = 'register';
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.registrationForm.controls.email.setValue('existing@example.com');
    await component.checkAvailability('email');
    expect(component.availabilityMessage.email).toContain('already registered');
  });

  it('allows a Firebase-only account to resume with its existing password', async () => {
    vi.mocked(TestBed.inject(AuthService).registrationAvailable).mockResolvedValue({
      available: false,
      recoverable: true,
    });
    const component = TestBed.createComponent(RegistrationComponent).componentInstance;
    component.registrationForm.controls.email.setValue('pending@example.com');
    expect(await component.checkAvailability('email')).toBe(true);
    expect(component.recoverExisting).toBe(true);
    expect(component.availabilityMessage.email).toContain('existing password');
  });

  it('validates professional details and matching passwords before review', async () => {
    const fixture = TestBed.createComponent(RegistrationComponent);
    const component = fixture.componentInstance;
    component.page = 'register';
    component.role = 'Doctor';
    component.registrationForm.patchValue({
      fullName: 'Example',
      email: 'person@example.com',
      phone: '0771234567',
    });
    await component.registrationNext();
    expect(component.registerStep).toBe(2);
    await component.registrationNext();
    expect(component.registerStep).toBe(2);
    component.registrationForm.patchValue({ professionalId: '123', organization: 'Clinic' });
    await component.registrationNext();
    expect(component.registerStep).toBe(3);
    component.registrationForm.patchValue({ password: 'password1', registerConfirm: 'different' });
    await component.registrationNext();
    expect(component.registerStep).toBe(3);
    component.registrationForm.patchValue({ registerConfirm: 'password1' });
    await component.registrationNext();
    expect(component.registerStep).toBe(4);
    await component.registrationNext();
    expect(component.message).toContain('No account has been created');
  });

  it('does not submit a reset form when passwords do not match', async () => {
    const fixture = TestBed.createComponent(AccessFormComponent);
    fixture.componentInstance.page = 'reset';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    for (const [name, value] of [
      ['password', 'password1'],
      ['confirm', 'different'],
    ]) {
      const input = element.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.busy).toBe(false);
    expect(element.textContent).toContain('Passwords must match.');
  });
});
