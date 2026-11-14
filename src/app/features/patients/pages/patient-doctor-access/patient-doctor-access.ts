import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
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
type GrantCategoryCode =
  | 'history_allergies'
  | 'prescriptions'
  | 'reports'
  | 'measurements_vaccinations'
  | 'medication_logs';

type GrantDuration = '24h' | '7d' | '30d';
type GrantStatus = 'active' | 'expired' | 'revoked';

interface SampleGrant {
  id: string;
  doctor: string;
  organization: string;
  categories: GrantCategoryCode[];
  allowConsultation: boolean;
  expiresAt: string;
  status: GrantStatus;
}

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

  readonly grantCategories: ReadonlyArray<{
    code: GrantCategoryCode;
    label: string;
  }> = [
    { code: 'history_allergies', label: 'Medical history and allergies' },
    { code: 'prescriptions', label: 'Prescriptions' },
    { code: 'reports', label: 'Laboratory reports' },
    {
      code: 'measurements_vaccinations',
      label: 'Measurements and vaccinations',
    },
    { code: 'medication_logs', label: 'Medication logs' },
  ];

  readonly grantForm = this.formBuilder.nonNullable.group({
    history_allergies: false,
    prescriptions: false,
    reports: false,
    measurements_vaccinations: false,
    medication_logs: false,
    duration: this.formBuilder.nonNullable.control<GrantDuration>('24h'),
    allowConsultation: false,
    confirmed: [false, Validators.requiredTrue],
  });

  onGrantChoiceChanged(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.getAttribute('formControlName') === 'confirmed') {
      this.grantError.set('');
      this.grantSummary.set(null);
      return;
    }

    this.clearGrantReview();
  }

  get selectedGrantCategories(): GrantCategoryCode[] {
    const values = this.grantForm.getRawValue();

    return this.grantCategories
      .filter((category) => values[category.code])
      .map((category) => category.code);
  }

  readonly isActiveSampleGrant = (grant: SampleGrant): boolean => grant.status === 'active';

  readonly pendingRevokeId = signal<string | null>(null);
  readonly revokeMessage = signal('');

  requestSampleRevoke(id: string): void {
    if (this.grantsView() !== 'ready') return;

    const grant = this.sampleGrants().find((item) => item.id === id);

    if (!grant || grant.status !== 'active') return;

    this.revokeMessage.set('');
    this.pendingRevokeId.set(id);
  }

  cancelSampleRevoke(): void {
    this.pendingRevokeId.set(null);
  }

  confirmSampleRevoke(id: string): void {
    if (this.grantsView() !== 'ready' || this.pendingRevokeId() !== id) {
      return;
    }

    const grant = this.sampleGrants().find((item) => item.id === id);

    if (!grant || grant.status !== 'active') return;

    this.sampleGrants.update((grants) =>
      grants.map((item) => (item.id === id ? { ...item, status: 'revoked' } : item)),
    );

    this.pendingRevokeId.set(null);
    this.revokeMessage.set(
      'Sample grant marked as revoked locally. No server permissions were changed.',
    );
  }

  readonly grantsView = signal<'ready' | 'loading' | 'empty' | 'error'>('ready');

  readonly sampleGrants = signal<SampleGrant[]>([
    {
      id: 'sample-grant-active',
      doctor: 'Sample Doctor A',
      organization: 'Fictional Clinic A',
      categories: ['prescriptions', 'reports'],
      allowConsultation: false,
      expiresAt: '2026-12-01T12:00:00Z',
      status: 'active',
    },
    {
      id: 'sample-grant-expired',
      doctor: 'Sample Doctor B',
      organization: 'Fictional Clinic B',
      categories: ['history_allergies'],
      allowConsultation: true,
      expiresAt: '2026-11-01T12:00:00Z',
      status: 'expired',
    },
    {
      id: 'sample-grant-revoked',
      doctor: 'Sample Doctor C',
      organization: 'Fictional Clinic C',
      categories: ['measurements_vaccinations'],
      allowConsultation: false,
      expiresAt: '2026-12-01T12:00:00Z',
      status: 'revoked',
    },
  ]);

  categoryLabel(code: GrantCategoryCode): string {
    return this.grantCategories.find((category) => category.code === code)?.label ?? code;
  }

  readonly grantError = signal('');

  readonly grantSummary = signal<{
    reference: string;
    categories: string[];
    duration: string;
    allowConsultation: boolean;
  } | null>(null);

  reviewGrantChoices(): void {
    this.grantError.set('');
    this.grantSummary.set(null);
    this.grantForm.markAllAsTouched();

    const reference = this.enteredCode();

    if (
      this.reviewStatus() !== 'ready' ||
      !reference ||
      this.codeForm.controls.doctorCode.value.trim() !== reference
    ) {
      this.grantError.set('Review the current doctor reference before reviewing access choices.');
      return;
    }

    const categories = this.selectedGrantCategories;

    if (categories.length === 0) {
      this.grantError.set('Select at least one record category.');
      return;
    }

    const values = this.grantForm.getRawValue();

    const durationLabels: Record<GrantDuration, string> = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    if (!Object.hasOwn(durationLabels, values.duration)) {
      this.grantError.set('Choose a valid access duration.');
      return;
    }

    if (!values.confirmed) {
      this.grantError.set('Confirm that you have reviewed your choices.');
      return;
    }

    this.grantSummary.set({
      reference,
      categories: this.grantCategories
        .filter((category) => categories.includes(category.code))
        .map((category) => category.label),
      duration: durationLabels[values.duration],
      allowConsultation: values.allowConsultation,
    });
  }

  clearGrantReview(): void {
    this.grantError.set('');
    this.grantSummary.set(null);
    this.grantForm.controls.confirmed.setValue(false);
  }

  // Signal-based UI state.
  readonly cameraStatus = signal<CameraStatus>('idle');
  readonly reviewStatus = signal<ReviewStatus>('empty');
  readonly cameraMessage = signal('');
  readonly reviewMessage = signal('');
  readonly enteredCode = signal('');
  readonly cameraStartInProgress = signal(false);

  private cameraStream?: MediaStream;
  private detector?: BarcodeDetectorLike;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private reviewTimer?: ReturnType<typeof setTimeout>;

  private cameraSession = 0;
  private scanInProgress = false;
  private destroyed = false;

  async startCamera(): Promise<void> {
    if (
      !isPlatformBrowser(this.platformId) ||
      this.destroyed ||
      this.cameraStartInProgress() ||
      this.cameraStatus() === 'scanning'
    ) {
      return;
    }

    this.cameraStartInProgress.set(true);
    const session = ++this.cameraSession;

    this.cameraMessage.set('');
    this.reviewMessage.set('');
    this.cameraStatus.set('requesting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (this.isCurrentSession(session)) {
          this.cameraStatus.set('unsupported');
          this.cameraMessage.set(
            'Camera access is not available in this browser. Please enter the doctor code manually.',
          );
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
          this.cameraStatus.set('unsupported');
          this.cameraMessage.set(
            'QR scanning is not supported in this browser. Please use manual code entry.',
          );
        }
        return;
      }

      this.detector = new detectorConstructor({
        formats: ['qr_code'],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      // Stop a stream if the user cancelled while permission was pending.
      if (!this.isCurrentSession(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.cameraStream = stream;

      const video = this.cameraVideo?.nativeElement;

      if (!video) {
        this.stopCamera();

        if (!this.destroyed) {
          this.cameraStatus.set('error');
          this.cameraMessage.set('Unable to initialise the camera preview.');
        }
        return;
      }

      video.srcObject = stream;
      await video.play();

      if (!this.isCurrentSession(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.cameraStatus.set('scanning');
      this.scanForQr(session);
    } catch {
      if (this.isCurrentSession(session)) {
        this.stopCamera();
        this.cameraStatus.set('error');
        this.cameraMessage.set(
          'Camera permission was denied or the camera could not be opened. You can enter the doctor code manually.',
        );
      }
    } finally {
      this.cameraStartInProgress.set(false);
    }
  }

  private isCurrentSession(session: number): boolean {
    return !this.destroyed && session === this.cameraSession;
  }

  private scheduleScan(session: number): void {
    if (!this.isCurrentSession(session) || this.cameraStatus() !== 'scanning') {
      return;
    }

    this.scanTimer = setTimeout(() => {
      this.scanTimer = undefined;
      void this.scanForQr(session);
    }, 300);
  }

  private async scanForQr(session: number): Promise<void> {
    if (
      !this.isCurrentSession(session) ||
      this.cameraStatus() !== 'scanning' ||
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
    let captured = false;

    try {
      const codes = await this.detector.detect(video);

      // Ignore results from a cancelled or replaced camera session.
      if (!this.isCurrentSession(session) || this.cameraStatus() !== 'scanning') {
        return;
      }

      const reference = codes[0]?.rawValue.trim();

      if (reference) {
        captured = true;
        this.codeForm.controls.doctorCode.setValue(reference);

        this.stopCamera();
        this.cameraStatus.set('found');
        this.reviewCode();
      }
    } catch {
      if (this.isCurrentSession(session)) {
        this.stopCamera();
        this.cameraStatus.set('error');
        this.cameraMessage.set(
          'The QR code could not be read. Please try again or enter the code manually.',
        );
      }
    } finally {
      this.scanInProgress = false;

      if (!captured && this.isCurrentSession(session) && this.cameraStatus() === 'scanning') {
        this.scheduleScan(session);
      }
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
    this.detector = undefined;

    const video = this.cameraVideo?.nativeElement;

    // Protect SSR/prerendering when media methods are unavailable.
    if (video && typeof video.pause === 'function') {
      video.pause();
      video.srcObject = null;
    }

    if (!this.destroyed) {
      this.cameraStatus.set('idle');
    }
  }

  reviewCode(): void {
    this.clearGrantReview();
    const code = this.codeForm.controls.doctorCode.value.trim();

    if (!code) {
      this.codeForm.controls.doctorCode.markAsTouched();
      this.enteredCode.set('');
      this.reviewStatus.set('error');
      this.reviewMessage.set('Please enter a doctor QR reference.');
      return;
    }

    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
      this.reviewTimer = undefined;
    }

    this.enteredCode.set(code);
    this.reviewStatus.set('loading');
    this.reviewMessage.set('Loading sample review preview...');

    // Local sample-state transition only. This is not an API request.
    this.reviewTimer = setTimeout(() => {
      this.reviewTimer = undefined;

      if (this.destroyed || this.enteredCode() !== code) {
        return;
      }

      this.reviewStatus.set('ready');
      this.reviewMessage.set(
        'Sample preview only. Doctor identity has not been verified by the server.',
      );
    }, 350);
  }

  clearCode(): void {
    this.clearGrantReview();

    this.stopCamera();

    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
      this.reviewTimer = undefined;
    }

    this.codeForm.reset({ doctorCode: '' });
    this.enteredCode.set('');
    this.reviewMessage.set('');
    this.cameraMessage.set('');
    this.reviewStatus.set('empty');
    this.cameraStatus.set('idle');
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
