import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

export interface DoctorQrResponse {
  doctor_reference: string;
  qr_payload: string;
}

export interface DoctorIdentity {
  user_id: string;
  role: 'doctor';
  display_name: string;
  verification_status: string;
  organization_id?: string | null;
  organization_name?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DoctorIdentityService {
  private readonly auth = inject(AuthService);

  getMyQr(): Promise<DoctorQrResponse> {
    return this.auth.getAuthorized<DoctorQrResponse>('me/doctor-qr');
  }

  resolve(reference: string): Promise<DoctorIdentity> {
    return this.auth.postAuthorized<DoctorIdentity>('doctor-qr/resolve', {
      doctor_reference: reference,
    });
  }
}
