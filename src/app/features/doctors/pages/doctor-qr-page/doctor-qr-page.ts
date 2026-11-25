import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DoctorIdentityService,
  DoctorQrResponse,
} from '../../../doctor-identity/doctor-identity.service';
import { qrSvgDataUrl } from '../../../doctor-identity/qr-svg';

@Component({
  selector: 'app-doctor-qr-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './doctor-qr-page.html',
  styleUrl: './doctor-qr-page.scss',
})
export class DoctorQrPage implements OnInit {
  private readonly identity = inject(DoctorIdentityService);
  readonly state = signal<'loading' | 'ready' | 'denied' | 'error'>('loading');
  readonly qr = signal<DoctorQrResponse | null>(null);
  readonly qrImage = signal('');
  readonly errorMessage = signal('');

  qrStatusLabel(): string {
    return this.qr() ? 'Approved' : 'Verification status unavailable';
  }

  ngOnInit(): void {
    void this.loadQr();
  }

  async loadQr(): Promise<void> {
    this.state.set('loading');
    this.errorMessage.set('');
    try {
      const response = await this.identity.getMyQr();
      if (
        !response.doctor_reference ||
        !response.qr_payload ||
        response.qr_payload !== response.doctor_reference
      ) {
        throw new Error('The server returned an invalid doctor QR reference.');
      }
      this.qrImage.set(qrSvgDataUrl(response.qr_payload));
      this.qr.set(response);
      this.state.set('ready');
    } catch (error) {
      this.qr.set(null);
      this.qrImage.set('');
      if (this.statusCode(error) === 403) {
        this.errorMessage.set('A QR code is available only for a verified doctor account.');
        this.state.set('denied');
      } else {
        this.errorMessage.set(
          this.statusCode(error) === 401
            ? 'Please sign in again to load your doctor QR code.'
            : 'The doctor QR service is unavailable. Please retry.',
        );
        this.state.set('error');
      }
    }
  }

  printQr(): void {
    window.print();
  }

  private statusCode(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : undefined;
  }
}
