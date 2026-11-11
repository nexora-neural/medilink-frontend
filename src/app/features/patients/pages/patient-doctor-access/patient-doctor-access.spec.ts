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

    fixture.detectChanges(false);

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
    expect(component.reviewStatus).toBe('empty');

    expect((fixture!.nativeElement as HTMLElement).textContent).toContain(
      'No doctor reference entered',
    );
  });

  it('shows a validation error when the manual reference is empty', () => {
    component.reviewCode();
    fixture!.detectChanges(false);

    expect(component.reviewStatus).toBe('error');
    expect(component.reviewMessage).toContain('Please enter');

    expect((fixture!.nativeElement as HTMLElement).textContent).toContain(
      'Unable to review reference',
    );
  });

  it('moves manual review from loading to ready', async () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');

    component.reviewCode();

    expect(component.reviewStatus).toBe('loading');

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(component.reviewStatus).toBe('ready');
    expect(component.enteredCode).toBe('DEMO-DOCTOR-01');
    expect(component.reviewMessage).toContain('Sample preview only');
  });

  it('shows an error when camera permission is denied', async () => {
    getUserMedia.mockRejectedValue(new Error('Permission denied'));

    await component.startCamera();
    fixture!.detectChanges(false);

    expect(component.cameraStatus).toBe('error');
    expect(component.cameraMessage).toContain('permission was denied');
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

    component.stopCamera();
  });

  it('captures a QR reference and starts the doctor review', async () => {
    const { stream } = createStream();

    getUserMedia.mockResolvedValue(stream);
    detectQr.mockResolvedValue([{ rawValue: 'DEMO-QR-DOCTOR-01' }]);

    await component.startCamera();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(detectQr).toHaveBeenCalled();
    expect(component.codeForm.controls.doctorCode.value).toBe('DEMO-QR-DOCTOR-01');
    expect(component.cameraStatus).toBe('found');
    expect(component.reviewStatus).toBe('loading');
    expect(component.enteredCode).toBe('DEMO-QR-DOCTOR-01');

    component.stopCamera();
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

    expect(component.codeForm.controls.doctorCode.value).toBe('');
    expect(component.cameraStatus).toBe('idle');
    expect(component.reviewStatus).toBe('empty');
    expect(component.enteredCode).toBe('');
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

    expect(stopTrack).toHaveBeenCalled();
    expect(component.cameraStatus).toBe('idle');
  });

  it('cleans up camera tracks when the component is destroyed', async () => {
    const { stream, stopTrack } = createStream();
    getUserMedia.mockResolvedValue(stream);

    await component.startCamera();

    fixture!.destroy();
    fixture = undefined;

    expect(stopTrack).toHaveBeenCalled();
    expect(component.cameraStream).toBeUndefined();
  });

  it('clears the entered reference and review state', () => {
    component.codeForm.controls.doctorCode.setValue('DEMO-DOCTOR-01');
    component.enteredCode = 'DEMO-DOCTOR-01';
    component.reviewStatus = 'ready';

    component.clearCode();
    fixture!.detectChanges(false);

    expect(component.codeForm.controls.doctorCode.value).toBe('');
    expect(component.enteredCode).toBe('');
    expect(component.reviewStatus).toBe('empty');
  });
});
