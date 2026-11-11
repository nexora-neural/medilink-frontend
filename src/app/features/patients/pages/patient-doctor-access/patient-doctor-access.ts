import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

@Component({
  selector: 'app-patient-doctor-access',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './patient-doctor-access.html',
  styleUrl: './patient-doctor-access.scss',
})
export class PatientDoctorAccess implements AfterViewInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);

  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;

  readonly codeForm = this.formBuilder.nonNullable.group({
    doctorCode: ['', Validators.required],
  });

  cameraStatus = 'idle';
  cameraMessage = '';
  reviewMessage = '';
  enteredCode = '';
  cameraStream?: MediaStream;
  detector?: BarcodeDetectorLike;
  scanTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    // Camera starts only after the patient presses the scan button.
  }

  async startCamera(): Promise<void> {
    this.cameraMessage = '';
    this.reviewMessage = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraStatus = 'unsupported';
      this.cameraMessage =
        'Camera access is not available in this browser. Please enter the doctor code manually.';
      return;
    }

    const detectorConstructor = (
      globalThis as typeof globalThis & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    if (!detectorConstructor) {
      this.cameraStatus = 'unsupported';
      this.cameraMessage =
        'QR scanning is not supported in this browser. Please use manual code entry.';
      return;
    }

    try {
      this.detector = new detectorConstructor({ formats: ['qr_code'] });

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      this.cameraStatus = 'scanning';

      const video = this.cameraVideo?.nativeElement;

      if (video) {
        video.srcObject = this.cameraStream;
        await video.play();
        this.scanForQr();
      }
    } catch {
      this.stopCamera();
      this.cameraStatus = 'error';
      this.cameraMessage =
        'Camera permission was denied or the camera could not be opened. You can enter the doctor code manually.';
    }
  }

  private scanForQr(): void {
    if (this.cameraStatus !== 'scanning' || !this.detector) {
      return;
    }

    const video = this.cameraVideo?.nativeElement;

    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.scanTimer = setTimeout(() => this.scanForQr(), 300);
      return;
    }

    this.detector
      .detect(video)
      .then((codes) => {
        if (codes.length > 0 && codes[0].rawValue.trim()) {
          this.codeForm.controls.doctorCode.setValue(codes[0].rawValue.trim());
          this.stopCamera();
          this.cameraStatus = 'found';
          this.reviewCode();
          return;
        }

        this.scanTimer = setTimeout(() => this.scanForQr(), 300);
      })
      .catch(() => {
        this.cameraStatus = 'error';
        this.cameraMessage =
          'The QR code could not be read. Please try again or enter the code manually.';
        this.stopCamera();
      });
  }

  stopCamera(): void {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }

    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;

    const video = this.cameraVideo?.nativeElement;

    // Video methods are available only in a real browser.
    if (typeof window !== 'undefined' && video && typeof video.pause === 'function') {
      video.pause();
      video.srcObject = null;
    }
  }

  reviewCode(): void {
    const code = this.codeForm.controls.doctorCode.value.trim();

    if (!code) {
      this.codeForm.controls.doctorCode.markAsTouched();
      this.reviewMessage = 'Please enter a doctor QR reference.';
      return;
    }

    this.enteredCode = code;
    this.reviewMessage =
      'Code captured locally. Doctor identity cannot be verified until the API is connected.';
  }

  clearCode(): void {
    this.stopCamera();
    this.codeForm.reset({ doctorCode: '' });
    this.enteredCode = '';
    this.reviewMessage = '';
    this.cameraMessage = '';
    this.cameraStatus = 'idle';
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
