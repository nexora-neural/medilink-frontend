import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccessFormComponent } from './components/access-form/access-form';
import { ProfessionalRolesComponent } from './components/professional-roles/professional-roles';
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
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.registerStep).toBe(2);
    expect(element.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('validates professional details and matching passwords before review', () => {
    const fixture = TestBed.createComponent(RegistrationComponent);
    const component = fixture.componentInstance;
    component.page = 'register';
    component.role = 'Doctor';
    component.registrationForm.patchValue({
      fullName: 'Example',
      email: 'person@example.com',
      phone: '0771234567',
    });
    component.registrationNext();
    expect(component.registerStep).toBe(2);
    component.registrationNext();
    expect(component.registerStep).toBe(2);
    component.registrationForm.patchValue({ professionalId: '123', organization: 'Clinic' });
    component.registrationNext();
    expect(component.registerStep).toBe(3);
    component.registrationForm.patchValue({ password: 'password1', registerConfirm: 'different' });
    component.registrationNext();
    expect(component.registerStep).toBe(3);
    component.registrationForm.patchValue({ registerConfirm: 'password1' });
    component.registrationNext();
    expect(component.registerStep).toBe(4);
    component.registrationNext();
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
