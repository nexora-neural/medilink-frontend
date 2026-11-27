import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { DoctorIdentityService } from '../../../doctor-identity/doctor-identity.service';
import { AccessGrant, AccessGrantsApiService } from './access-grants-api.service';
import { PatientDoctorAccess } from './patient-doctor-access';

describe('PatientDoctorAccess', () => {
  let fixture: ComponentFixture<PatientDoctorAccess> | undefined;
  let component: PatientDoctorAccess;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let detectQr: ReturnType<typeof vi.fn>;
  let originalMediaDevices: PropertyDescriptor | undefined;
  let identityApi: {
    resolve: ReturnType<typeof vi.fn>;
    resolveDoctor: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  const createStream = () => {
    const stopTrack = vi.fn();

    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    return { stream, stopTrack };
  };

  class FakeBarcodeDetector {
    constructor(_options?: { formats: string[] }) {}

    detect = detectQr;
  }

  const getScreenText = (): string => (fixture!.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    getUserMedia = vi.fn();
    detectQr = vi.fn().mockResolvedValue([]);
    const resolveDoctor = vi.fn().mockResolvedValue({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Dr Test',
      verification_status: 'approved',
      organization_id: 'clinic-1',
      organization_name: 'Test Clinic',
    });
    identityApi = {
      resolve: resolveDoctor,
      resolveDoctor,
      create: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({ items: [], page: 1, page_size: 100, total: 0 }),
      revoke: vi.fn().mockResolvedValue({}),
    };

    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector);

    await TestBed.configureTestingModule({
      imports: [PatientDoctorAccess],
      providers: [
        provideRouter([]),
        { provide: DoctorIdentityService, useValue: { resolve: identityApi.resolve } },
        { provide: AccessGrantsApiService, useValue: identityApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientDoctorAccess);
    component = fixture.componentInstance;

    // Initial rendering only. Subsequent UI updates must happen automatically.
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;

    Object.defineProperty(video, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    Object.defineProperty(video, 'pause', {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;

    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the empty doctor review state initially', () => {
    expect(component.reviewStatus()).toBe('empty');

    expect(getScreenText()).toContain('No doctor reference entered');
  });

  it('navigates back to the workspace dashboard', () => {
    const dashboardLink = fixture!.nativeElement.querySelector('.back-link') as HTMLAnchorElement;

    expect(dashboardLink.getAttribute('routerLink')).toBe('/workspace');
    expect(dashboardLink.textContent).toContain('Back to dashboard');
  });

  it('shows a validation error when the manual reference is empty', async () => {
    component.reviewCode();

    await fixture!.whenStable();

    expect(component.reviewStatus()).toBe('error');
    expect(component.reviewMessage()).toContain('Please enter');

    expect(getScreenText()).toContain('Unable to review reference');
    expect(getScreenText()).toContain('Please enter a doctor QR reference.');
  });

  it('accepts the 256-character reference boundary', async () => {
    component.codeForm.controls.doctorCode.setValue('A'.repeat(256));
    component.reviewCode();
    await vi.waitFor(() => expect(identityApi.resolveDoctor).toHaveBeenCalledWith('A'.repeat(256)));
  });

  it.each([257, 260])('rejects a %i-character reference before calling the API', async (length) => {
    component.codeForm.controls.doctorCode.setValue('A'.repeat(length));
    component.reviewCode();
    await fixture!.whenStable();
    expect(component.reviewStatus()).toBe('error');
    expect(component.reviewMessage()).toContain('must not exceed 256');
    expect(identityApi.resolveDoctor).not.toHaveBeenCalled();
    expect(component.resolvedDoctor()).toBeNull();
  });

  it('shows a validation message for a backend 422 response and can resolve a valid reference afterward', async () => {
    identityApi.resolveDoctor.mockRejectedValueOnce(new HttpErrorResponse({ status: 422 }));
    component.codeForm.controls.doctorCode.setValue('A'.repeat(256));
    component.reviewCode();
    await vi.waitFor(() => expect(component.reviewStatus()).toBe('error'));
    expect(component.reviewMessage()).toContain('must not exceed 256');
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.reviewCode();
    await vi.waitFor(() => expect(component.reviewStatus()).toBe('ready'));
    expect(component.resolvedDoctor()?.display_name).toBe('Dr Test');
  });

  it('resolves the current doctor identity with the API and renders server details', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');

    component.reviewCode();

    await fixture!.whenStable();
    await vi.waitFor(() =>
      expect(identityApi.resolveDoctor).toHaveBeenCalledWith('DEMO-DOCTOR-01'),
    );

    expect(component.reviewStatus()).toBe('ready');
    expect(component.enteredCode()).toBe('DEMO-DOCTOR-01');
    expect(component.resolvedDoctor()?.verification_status).toBe('approved');
    expect(getScreenText()).toContain('Doctor reference resolved');
    expect(getScreenText()).toContain('Dr Test');
    expect(getScreenText()).toContain('Test Clinic');
  });

  it('clears a resolved identity as soon as the reference is edited', async () => {
    component.enteredCode.set('DEMO-DOCTOR-01');
    component.resolvedDoctor.set({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Demo Doctor',
      verification_status: 'approved',
    });
    component.reviewStatus.set('ready');
    component.onReferenceInput();
    expect(component.resolvedDoctor()).toBeNull();
    expect(component.reviewStatus()).toBe('empty');
  });

  it.each(['success', 'error'] as const)(
    'ignores an older %s response after the same reference is resubmitted',
    async (olderOutcome) => {
      let finishOld!: (value: unknown) => void;
      let failOld!: (reason: unknown) => void;
      identityApi.resolveDoctor.mockReset();
      identityApi.resolveDoctor.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finishOld = resolve;
          failOld = reject;
        }),
      );
      identityApi.resolveDoctor.mockResolvedValueOnce({
        user_id: 'doctor-1',
        role: 'doctor',
        display_name: 'Dr Test',
        verification_status: 'suspended',
      });
      component.codeForm.controls.doctorCode.setValue('SAME-REFERENCE');
      component.reviewCode();
      component.clearCode();
      component.codeForm.controls.doctorCode.setValue('SAME-REFERENCE');
      component.reviewCode();
      await vi.waitFor(() =>
        expect(component.resolvedDoctor()?.verification_status).toBe('suspended'),
      );

      if (olderOutcome === 'success') {
        finishOld({
          user_id: 'doctor-1',
          role: 'doctor',
          display_name: 'Dr Test',
          verification_status: 'approved',
        });
      } else {
        failOld(new HttpErrorResponse({ status: 404 }));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(component.reviewStatus()).toBe('ready');
      expect(component.resolvedDoctor()?.verification_status).toBe('suspended');
    },
  );

  it('automatically updates the visible screen when camera permission is denied', async () => {
    getUserMedia.mockRejectedValue(new Error('Permission denied'));

    await component.startCamera();
    await fixture!.whenStable();

    expect(component.cameraStatus()).toBe('error');
    expect(component.cameraMessage()).toContain('permission was denied');

    expect(getScreenText()).toContain('Camera could not be started');
    expect(getScreenText()).toContain('permission was denied');
  });

  it('prevents overlapping camera permission requests', async () => {
    let resolvePermission!: (stream: MediaStream) => void;

    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const { stream } = createStream();

    const firstRequest = component.startCamera();
    const secondRequest = component.startCamera();

    expect(getUserMedia).toHaveBeenCalledTimes(1);

    resolvePermission(stream);

    await Promise.all([firstRequest, secondRequest]);
    await fixture!.whenStable();

    component.stopCamera();
  });

  it('automatically resolves a captured QR reference with the API', async () => {
    const { stream } = createStream();

    getUserMedia.mockResolvedValue(stream);
    detectQr.mockResolvedValue([{ rawValue: 'DEMO-QR-DOCTOR-01' }]);

    await component.startCamera();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await vi.waitFor(() =>
      expect(identityApi.resolveDoctor).toHaveBeenCalledWith('DEMO-QR-DOCTOR-01'),
    );
    await fixture!.whenStable();

    expect(detectQr).toHaveBeenCalled();

    expect(component.codeForm.controls.doctorCode.value).toBe('DEMO-QR-DOCTOR-01');

    expect(component.cameraStatus()).toBe('found');
    expect(component.enteredCode()).toBe('DEMO-QR-DOCTOR-01');

    expect(getScreenText()).toContain('QR reference captured');
    expect(identityApi.resolveDoctor).toHaveBeenCalledWith('DEMO-QR-DOCTOR-01');
    expect(getScreenText()).toContain('Doctor reference resolved');
  });

  it('rejects an overlong reference captured from a QR code before calling the API', async () => {
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);
    detectQr.mockResolvedValue([{ rawValue: 'Q'.repeat(260) }]);

    await component.startCamera();
    await vi.waitFor(() => expect(component.reviewStatus()).toBe('error'));

    expect(identityApi.resolveDoctor).not.toHaveBeenCalled();
    expect(component.reviewMessage()).toContain('must not exceed 256');
    expect(component.resolvedDoctor()).toBeNull();
  });

  it.each([
    [404, 'not found or is no longer active'],
    [403, 'not allowed to verify'],
    [0, 'service is unavailable'],
  ])('shows a safe server error state for status %s', async (status, message) => {
    identityApi.resolveDoctor.mockRejectedValue(new HttpErrorResponse({ status }));
    component.codeForm.controls.doctorCode.setValue('OPAQUE-REF');
    component.reviewCode();
    await vi.waitFor(() => expect(component.reviewStatus()).toBe('error'));
    expect(component.reviewMessage()).toContain(message);
    expect(component.resolvedDoctor()).toBeNull();
  });

  it('ignores a QR result returned after scan cancellation', async () => {
    let resolveDetection!: (result: Array<{ rawValue: string }>) => void;

    const { stream } = createStream();

    getUserMedia.mockResolvedValue(stream);

    detectQr.mockReturnValue(
      new Promise((resolve) => {
        resolveDetection = resolve;
      }),
    );

    await component.startCamera();

    expect(detectQr).toHaveBeenCalled();

    component.stopCamera();

    resolveDetection([{ rawValue: 'CANCELLED-QR-REFERENCE' }]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture!.whenStable();

    expect(component.codeForm.controls.doctorCode.value).toBe('');
    expect(component.cameraStatus()).toBe('idle');
    expect(component.reviewStatus()).toBe('empty');
    expect(component.enteredCode()).toBe('');

    expect(getScreenText()).toContain('No doctor reference entered');
    expect(getScreenText()).not.toContain('CANCELLED-QR-REFERENCE');
  });

  it('stops a stream when permission resolves after cancellation', async () => {
    let resolvePermission!: (stream: MediaStream) => void;

    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const { stream, stopTrack } = createStream();

    const request = component.startCamera();

    component.stopCamera();

    resolvePermission(stream);

    await request;
    await fixture!.whenStable();

    expect(stopTrack).toHaveBeenCalled();
    expect(component.cameraStatus()).toBe('idle');
    expect(getScreenText()).toContain('Camera is not active');
  });

  it('cleans up camera tracks when the component is destroyed', async () => {
    const { stream, stopTrack } = createStream();

    getUserMedia.mockResolvedValue(stream);

    await component.startCamera();

    fixture!.destroy();
    fixture = undefined;

    expect(stopTrack).toHaveBeenCalled();
  });

  it('clears the entered reference and automatically resets the visible review state', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.reviewCode();

    await new Promise((resolve) => setTimeout(resolve, 400));
    await fixture!.whenStable();

    expect(component.reviewStatus()).toBe('ready');

    component.clearCode();

    await fixture!.whenStable();

    expect(component.codeForm.controls.doctorCode.value).toBe('');
    expect(component.enteredCode()).toBe('');
    expect(component.reviewStatus()).toBe('empty');

    expect(getScreenText()).toContain('No doctor reference entered');
    expect(getScreenText()).not.toContain('DEMO-DOCTOR-01');
  });
  it('keeps category selections when duration changes and resets confirmation', async () => {
    const root = fixture!.nativeElement as HTMLElement;

    const prescription = root.querySelector('#grant-category-prescriptions') as HTMLInputElement;

    const confirmation = root.querySelector(
      'input[formControlName="confirmed"]',
    ) as HTMLInputElement;

    const sevenDays = root.querySelector('input[type="radio"][value="7d"]') as HTMLInputElement;

    prescription.click();
    await fixture!.whenStable();

    confirmation.click();
    await fixture!.whenStable();

    expect(component.grantForm.controls.confirmed.value).toBe(true);

    sevenDays.click();
    await fixture!.whenStable();

    expect(prescription.checked).toBe(true);
    expect(component.selectedGrantCategories).toEqual(['prescriptions']);
    expect(component.grantForm.controls.duration.value).toBe('7d');
    expect(component.grantForm.controls.confirmed.value).toBe(false);
    expect(confirmation.checked).toBe(false);
  });

  it('requires a reviewed reference, categories and explicit confirmation', () => {
    component.reviewGrantChoices();
    expect(component.grantError()).toContain('doctor reference');
    expect(component.grantSummary()).toBeNull();

    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.enteredCode.set('DEMO-DOCTOR-01');
    component.reviewStatus.set('ready');
    component.resolvedDoctor.set({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Dr Test',
      verification_status: 'approved',
    });

    component.reviewGrantChoices();
    expect(component.grantError()).toContain('at least one');

    component.grantForm.controls.prescriptions.setValue(true);
    component.reviewGrantChoices();
    expect(component.grantError()).toContain('Confirm');

    component.grantForm.controls.confirmed.setValue(true);
    component.reviewGrantChoices();

    expect(component.grantError()).toBe('');
    expect(component.grantSummary()).toEqual({
      reference: 'DEMO-DOCTOR-01',
      categories: ['Prescriptions'],
      duration: '24 hours',
      allowConsultation: false,
    });
  });

  it('clears the summary and confirmation when the reference is edited', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.enteredCode.set('DEMO-DOCTOR-01');
    component.reviewStatus.set('ready');
    component.resolvedDoctor.set({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Dr Test',
      verification_status: 'approved',
    });
    component.grantForm.patchValue({
      prescriptions: true,
      confirmed: true,
    });
    component.reviewGrantChoices();

    await fixture!.whenStable();
    expect(component.grantSummary()).not.toBeNull();

    const reference = fixture!.nativeElement.querySelector('#doctorCode') as HTMLInputElement;

    reference.value = '';
    reference.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture!.whenStable();

    expect(component.grantSummary()).toBeNull();
    expect(component.grantForm.controls.confirmed.value).toBe(false);
    expect(component.grantForm.controls.prescriptions.value).toBe(true);
    expect(fixture!.nativeElement.querySelector('.grant-summary')).toBeNull();
  });

  it('creates a real grant with the reviewed doctor and selected scope', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.enteredCode.set('DEMO-DOCTOR-01');
    component.resolvedDoctor.set({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Dr Test',
      verification_status: 'approved',
      organization_id: 'clinic-1',
      organization_name: 'Test Clinic',
    });
    component.reviewStatus.set('ready');
    component.grantForm.patchValue({
      prescriptions: true,
      duration: '7d',
      allowConsultation: true,
      confirmed: true,
    });
    component.reviewGrantChoices();
    fixture!.detectChanges();
    const confirmButton = fixture!.nativeElement.querySelector(
      '.grant-summary button',
    ) as HTMLButtonElement;
    expect(confirmButton.textContent).toContain('Confirm and grant access');
    confirmButton.click();
    await fixture!.whenStable();
    expect(identityApi.create).toHaveBeenCalledWith({
      doctor_reference: 'DEMO-DOCTOR-01',
      organization_id: 'clinic-1',
      categories: ['prescriptions'],
      duration_hours: 168,
      allow_consultation: true,
    });
    expect(identityApi.list).toHaveBeenCalled();
    expect(component.grantSuccess()).toContain('successfully');
  });

  it('keeps a server-active grant revocable when the device clock is ahead', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-25T12:30:00Z'));
    const grant: AccessGrant = {
      grant: {
        id: 'clock-skew-grant',
        patient_user_id: 'patient-1',
        professional_user_id: 'doctor-1',
        organization_id: null,
        allow_consultation: false,
        status: 'active',
        starts_at: '2026-11-25T00:00:00Z',
        expires_at: '2026-11-25T12:20:00Z',
        revoked_at: null,
        created_at: '2026-11-25T00:00:00Z',
      },
      doctor_display_name: 'Dr Clock Test',
      categories: ['prescriptions'],
    };
    identityApi.list.mockResolvedValue({ items: [grant], page: 1, page_size: 100, total: 1 });

    await component.loadGrants();
    fixture!.detectChanges();
    expect(component.grantStatus(grant)).toBe('active');
    const revoke = fixture!.nativeElement.querySelector(
      '[aria-label="Revoke access for Dr Clock Test"]',
    ) as HTMLButtonElement | null;
    expect(revoke).not.toBeNull();
    revoke!.click();
    component.revokeReason.set('Patient requested access removal');
    await component.confirmRevoke('clock-skew-grant');
    expect(identityApi.revoke).toHaveBeenCalledWith(
      'clock-skew-grant',
      'Patient requested access removal',
    );
  });

  it('requires a revoke reason and only reports success after the API confirms', async () => {
    const grant = {
      grant: {
        id: 'grant-1',
        patient_user_id: 'patient-1',
        professional_user_id: 'doctor-1',
        organization_id: null,
        allow_consultation: false,
        status: 'active',
        starts_at: '2026-11-25T00:00:00Z',
        expires_at: '2026-11-26T00:00:00Z',
        revoked_at: null,
        created_at: '2026-11-25T00:00:00Z',
      },
      categories: ['prescriptions'],
    };
    identityApi.list.mockResolvedValue({ items: [grant], page: 1, page_size: 100, total: 1 });
    await component.loadGrants();
    component.requestRevoke('grant-1');
    await component.confirmRevoke('grant-1');
    expect(component.revokeError()).toContain('reason');
    expect(identityApi.revoke).not.toHaveBeenCalled();
    component.revokeReason.set('Patient requested access removal');
    await component.confirmRevoke('grant-1');
    expect(identityApi.revoke).toHaveBeenCalledWith('grant-1', 'Patient requested access removal');
    expect(component.revokeMessage()).toContain('successfully');
    expect(component.grants()).toEqual([grant]);
  });

  it('does not claim a grant was saved when the API fails', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.enteredCode.set('DEMO-DOCTOR-01');
    component.resolvedDoctor.set({
      user_id: 'doctor-1',
      role: 'doctor',
      display_name: 'Dr Test',
      verification_status: 'approved',
    });
    component.reviewStatus.set('ready');
    component.grantForm.patchValue({ prescriptions: true, confirmed: true });
    component.reviewGrantChoices();
    identityApi.create.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await component.createGrant();
    expect(component.grantSuccess()).toBe('');
    expect(component.grantCreateError()).toContain('unavailable');
    await fixture!.whenStable();
    expect(getScreenText()).toContain('service is unavailable');
  });
});
