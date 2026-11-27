import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService, OnboardingRequestError } from '../../../../../core/auth.service';
import { RegistrationComponent } from './registration';

describe('RegistrationComponent', () => {
  it('keeps the review form recoverable when backend onboarding fails', async () => {
    const registerProfessional = vi
      .fn()
      .mockRejectedValueOnce(new OnboardingRequestError(new Error('temporary backend failure')))
      .mockResolvedValueOnce(undefined);
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { registerProfessional, registrationAvailable: vi.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: { data: of({}), queryParams: of({}), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentRef.setInput('page', 'register');
    fixture.componentRef.setInput('role', 'Doctor');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.registrationForm.patchValue({
      fullName: 'Demo Doctor',
      email: 'doctor@example.com',
      phone: '771234567',
      professionalId: 'SLMC-123',
      organization: 'Demo Clinic',
      password: 'fictional-test-password',
      registerConfirm: 'fictional-test-password',
    });
    component.registerStep = 4;
    (component as unknown as { router: { navigate: typeof navigate } }).router.navigate = navigate;

    await component.registrationNext();

    expect(component.recoverExisting).toBe(true);
    expect(component.message).toContain('same password');
    expect(navigate).not.toHaveBeenCalled();
    registerProfessional.mockClear();
    await component.registrationNext();
    expect(registerProfessional).toHaveBeenCalledWith(
      expect.objectContaining({ recoverExisting: true }),
    );
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'register',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentRef.setInput('page', data.page);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="fullName"]')).not.toBeNull();
    expect(element.querySelector('.register-progress')?.getAttribute('aria-label')).toBe(
      'Step 1 of 3',
    );
  });

  it('creates a doctor account and continues to verification after review', async () => {
    const registerProfessional = vi.fn().mockResolvedValue(undefined);
    const registerPatient = vi.fn();
    const registrationAvailable = vi.fn().mockResolvedValue({
      available: true,
      recoverable: false,
    });
    const auth = { registerProfessional, registerPatient, registrationAvailable };
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { data: of({}), queryParams: of({}), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentRef.setInput('page', 'register');
    fixture.componentRef.setInput('role', 'Doctor');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.registrationForm.patchValue({
      fullName: 'Demo Doctor',
      email: 'doctor@example.com',
      phone: '771234567',
      professionalId: 'SLMC123',
      organization: 'Demo Clinic',
      password: 'fictional-test-password',
      registerConfirm: 'fictional-test-password',
    });
    (component as unknown as { router: { navigate: typeof navigate } }).router.navigate = navigate;

    await component.registrationNext();
    expect(component.registerStep).toBe(2);
    expect(registrationAvailable).toHaveBeenCalledWith('email', 'doctor@example.com');
    expect(registrationAvailable).toHaveBeenCalledWith('phone', '+94771234567');

    await component.registrationNext();
    expect(component.registerStep).toBe(3);

    await component.registrationNext();
    expect(component.registerStep).toBe(4);

    await component.registrationNext();

    expect(registerProfessional).toHaveBeenCalledWith({
      email: 'doctor@example.com',
      password: 'fictional-test-password',
      displayName: 'Demo Doctor',
      phone: '+94771234567',
      requestedRole: 'doctor',
      professionalRegistrationNumber: 'SLMC123',
      workplace: 'Demo Clinic',
      recoverExisting: false,
    });
    expect(registerPatient).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/workspace/professional-verification'], {
      state: {
        professionalRegistration: {
          role: 'doctor',
          registrationNumber: 'SLMC123',
          workplace: 'Demo Clinic',
        },
      },
    });
    expect(component.message).toBe('');
  });

  it('does not assign a professional role before verification approval', async () => {
    const registerProfessional = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { registerProfessional, registrationAvailable: vi.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: { data: of({}), queryParams: of({}), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegistrationComponent);
    fixture.componentRef.setInput('page', 'register');
    fixture.componentRef.setInput('role', 'Doctor');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.registrationForm.patchValue({
      fullName: 'Demo Doctor',
      email: 'doctor@example.com',
      phone: '771234567',
      professionalId: 'SLMC123',
      organization: 'Demo Clinic',
      password: 'fictional-test-password',
      registerConfirm: 'fictional-test-password',
    });
    component.registerStep = 4;
    (component as unknown as { router: { navigate: typeof navigate } }).router.navigate = navigate;

    await component.registrationNext();

    expect(registerProfessional).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      ['/workspace/professional-verification'],
      expect.objectContaining({ state: expect.any(Object) }),
    );
    expect(navigate).not.toHaveBeenCalledWith(['/workspace/doctor']);
  });
});
