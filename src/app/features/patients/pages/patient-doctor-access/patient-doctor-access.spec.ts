import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PatientDoctorAccess } from './patient-doctor-access';

describe('PatientDoctorAccess', () => {
  let fixture: ComponentFixture<PatientDoctorAccess> | undefined;
  let component: PatientDoctorAccess;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let detectQr: ReturnType<typeof vi.fn>;
  let originalMediaDevices: PropertyDescriptor | undefined;

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

    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector);

    await TestBed.configureTestingModule({
      imports: [PatientDoctorAccess],
      providers: [provideRouter([])],
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

  it('automatically updates the visible screen from loading to ready', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');

    component.reviewCode();

    await fixture!.whenStable();

    expect(component.reviewStatus()).toBe('loading');
    expect(getScreenText()).toContain('Loading sample review');

    await new Promise((resolve) => setTimeout(resolve, 400));
    await fixture!.whenStable();

    expect(component.reviewStatus()).toBe('ready');
    expect(component.enteredCode()).toBe('DEMO-DOCTOR-01');
    expect(component.reviewMessage()).toContain('Sample preview only');

    expect(getScreenText()).toContain('Sample review ready');
    expect(getScreenText()).toContain('DEMO-DOCTOR-01');
    expect(getScreenText()).toContain('Not verified');
  });

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

  it('automatically displays a captured QR reference and starts doctor review', async () => {
    const { stream } = createStream();

    getUserMedia.mockResolvedValue(stream);
    detectQr.mockResolvedValue([{ rawValue: 'DEMO-QR-DOCTOR-01' }]);

    await component.startCamera();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture!.whenStable();

    expect(detectQr).toHaveBeenCalled();

    expect(component.codeForm.controls.doctorCode.value).toBe('DEMO-QR-DOCTOR-01');

    expect(component.cameraStatus()).toBe('found');
    expect(component.reviewStatus()).toBe('loading');
    expect(component.enteredCode()).toBe('DEMO-QR-DOCTOR-01');

    expect(getScreenText()).toContain('QR reference captured');
    expect(getScreenText()).toContain('DEMO-QR-DOCTOR-01');
    expect(getScreenText()).toContain('Loading sample review');
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

  it('requires matching confirmation before revoking a sample grant', () => {
    const id = 'sample-grant-active';

    component.confirmSampleRevoke(id);
    expect(component.sampleGrants().find((grant) => grant.id === id)?.status).toBe('active');

    component.requestSampleRevoke(id);
    component.cancelSampleRevoke();
    component.confirmSampleRevoke(id);

    expect(component.sampleGrants().find((grant) => grant.id === id)?.status).toBe('active');
  });

  it('moves a confirmed sample revoke into history and shows the empty active state', async () => {
    const root = fixture!.nativeElement as HTMLElement;

    const revoke = root.querySelector(
      'button[aria-label="Revoke sample grant for Sample Doctor A"]',
    ) as HTMLButtonElement;

    revoke.click();
    await fixture!.whenStable();

    const confirm = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirm sample revoke',
    );

    expect(confirm).toBeDefined();
    confirm!.click();
    await fixture!.whenStable();

    expect(getScreenText()).toContain('No active sample grants.');
    expect(getScreenText()).toContain('No server permissions were changed.');

    const history = root.querySelector('.grant-history') as HTMLDetailsElement;

    expect(history.textContent).toContain('Sample Doctor A');
    expect(history.textContent).toContain('Revoked');
    expect(
      root.querySelector('button[aria-label="Revoke sample grant for Sample Doctor A"]'),
    ).toBeNull();
  });
});
