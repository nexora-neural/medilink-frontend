import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

type CameraStatus = 'idle' | 'requesting' | 'scanning' | 'found' | 'unsupported' | 'error';

type ReviewStatus = 'empty' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-patient-doctor-access',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './patient-doctor-access.html',
  styleUrl: './patient-doctor-access.scss',
})
export class PatientDoctorAccess implements OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;

  readonly codeForm = this.formBuilder.nonNullable.group({
    doctorCode: ['', Validators.required],
  });

  cameraStatus: CameraStatus = 'idle';
  reviewStatus: ReviewStatus = 'empty';

  cameraMessage = '';
  reviewMessage = '';
  enteredCode = '';

  cameraStream?: MediaStream;
  detector?: BarcodeDetectorLike;
  scanTimer?: ReturnType<typeof setTimeout>;
  reviewTimer?: ReturnType<typeof setTimeout>;

  cameraStartInProgress = false;

  private cameraSession = 0;
  private scanInProgress = false;
  private destroyed = false;

  async startCamera(): Promise<void> {
    if (
      !isPlatformBrowser(this.platformId) ||
      this.destroyed ||
      this.cameraStartInProgress ||
      this.cameraStatus === 'scanning'
    ) {
      return;
    }

    this.cameraStartInProgress = true;
    const session = ++this.cameraSession;

    this.cameraMessage = '';
    this.reviewMessage = '';
    this.cameraStatus = 'requesting';

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (this.isCurrentSession(session)) {
          this.cameraStatus = 'unsupported';
          this.cameraMessage =
            'Camera access is not available in this browser. Please enter the doctor code manually.';
        }
        return;
      }

      const detectorConstructor = (
        globalThis as typeof globalThis & {
          BarcodeDetector?: BarcodeDetectorConstructor;
        }
      ).BarcodeDetector;

      if (!detectorConstructor) {
        if (this.isCurrentSession(session)) {
          this.cameraStatus = 'unsupported';
          this.cameraMessage =
            'QR scanning is not supported in this browser. Please use manual code entry.';
        }
        return;
      }

      this.detector = new detectorConstructor({ formats: ['qr_code'] });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      // Permission may resolve after the user leaves or cancels.
      if (!this.isCurrentSession(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.cameraStream = stream;

      const video = this.cameraVideo?.nativeElement;

      if (!video) {
        this.stopCamera();
        if (!this.destroyed) {
          this.cameraStatus = 'error';
          this.cameraMessage = 'Unable to initialise the camera preview.';
        }
        return;
      }

      video.srcObject = stream;
      await video.play();

      // The page may have been closed while video.play() was pending.
      if (!this.isCurrentSession(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.cameraStatus = 'scanning';
      this.scanForQr(session);
    } catch {
      if (this.isCurrentSession(session)) {
        this.stopCamera();
        this.cameraStatus = 'error';
        this.cameraMessage =
          'Camera permission was denied or the camera could not be opened. You can enter the doctor code manually.';
      }
    } finally {
      this.cameraStartInProgress = false;
    }
  }

  private isCurrentSession(session: number): boolean {
    return !this.destroyed && session === this.cameraSession;
  }

  private scheduleScan(session: number): void {
    if (!this.isCurrentSession(session) || this.cameraStatus !== 'scanning') {
      return;
    }

    this.scanTimer = setTimeout(() => this.scanForQr(session), 300);
  }

  private async scanForQr(session: number): Promise<void> {
    if (
      !this.isCurrentSession(session) ||
      this.cameraStatus !== 'scanning' ||
      !this.detector ||
      this.scanInProgress
    ) {
      return;
    }

    const video = this.cameraVideo?.nativeElement;

    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.scheduleScan(session);
      return;
    }

    this.scanInProgress = true;

    try {
      const codes = await this.detector.detect(video);

      // Ignore results from a cancelled or replaced scan.
      if (!this.isCurrentSession(session) || this.cameraStatus !== 'scanning') {
        return;
      }

      const reference = codes[0]?.rawValue.trim();

      if (reference) {
        this.codeForm.controls.doctorCode.setValue(reference);
        this.stopCamera();
        this.cameraStatus = 'found';
        this.reviewCode();
        return;
      }

      this.scheduleScan(session);
    } catch {
      if (this.isCurrentSession(session)) {
        this.stopCamera();
        this.cameraStatus = 'error';
        this.cameraMessage =
          'The QR code could not be read. Please try again or enter the code manually.';
      }
    } finally {
      this.scanInProgress = false;
    }
  }

  stopCamera(): void {
    // Invalidate pending permission and scan operations.
    this.cameraSession++;

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }

    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;

    const video = this.cameraVideo?.nativeElement;

    if (typeof window !== 'undefined' && video && typeof video.pause === 'function') {
      video.pause();
      video.srcObject = null;
    }

    if (!this.destroyed) {
      this.cameraStatus = 'idle';
    }
  }

  reviewCode(): void {
    const code = this.codeForm.controls.doctorCode.value.trim();

    if (!code) {
      this.codeForm.controls.doctorCode.markAsTouched();
      this.enteredCode = '';
      this.reviewStatus = 'error';
      this.reviewMessage = 'Please enter a doctor QR reference.';
      return;
    }

    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
    }

    this.enteredCode = code;
    this.reviewStatus = 'loading';
    this.reviewMessage = 'Loading sample review preview...';

    // Local sample-state transition only. This is not an API request.
    this.reviewTimer = setTimeout(() => {
      if (this.destroyed || this.enteredCode !== code) {
        return;
      }

      this.reviewStatus = 'ready';
      this.reviewMessage =
        'Sample preview only. Doctor identity has not been verified by the server.';
    }, 350);
  }

  clearCode(): void {
    this.stopCamera();

    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
      this.reviewTimer = undefined;
    }

    this.codeForm.reset({ doctorCode: '' });
    this.enteredCode = '';
    this.reviewMessage = '';
    this.cameraMessage = '';
    this.reviewStatus = 'empty';
    this.cameraStatus = 'idle';
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
      this.reviewTimer = undefined;
    }

    this.stopCamera();
  }
}
