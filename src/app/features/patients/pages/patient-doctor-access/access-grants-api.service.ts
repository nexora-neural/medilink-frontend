import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth.service';

export type GrantCategory =
  | 'history_allergies'
  | 'prescriptions'
  | 'reports'
  | 'measurements_vaccinations'
  | 'medication_logs';
export type GrantStatus = 'active' | 'expired' | 'revoked';

export interface DoctorIdentity {
  user_id: string;
  role: 'doctor';
  display_name: string;
  verification_status: string;
  organization_id?: string | null;
  organization_name?: string | null;
}

export interface AccessGrant {
  doctor_display_name?: string | null;
  grant: {
    id: string;
    patient_user_id: string;
    professional_user_id: string;
    organization_id: string | null;
    allow_consultation: boolean;
    status: GrantStatus;
    starts_at: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
  };
  categories: GrantCategory[];
}

export interface AccessGrantPage {
  items: AccessGrant[];
  page: number;
  page_size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AccessGrantsApiService {
  private readonly auth = inject(AuthService);

  resolveDoctor(reference: string): Promise<DoctorIdentity> {
    return this.auth.postAuthorized('doctor-qr/resolve', { doctor_reference: reference });
  }

  create(input: {
    doctor_reference: string;
    organization_id: string | null;
    categories: GrantCategory[];
    duration_hours: 24 | 168 | 720;
    allow_consultation: boolean;
  }): Promise<AccessGrant> {
    return this.auth.postAuthorized('access-grants', input);
  }

  list(page = 1): Promise<AccessGrantPage> {
    return this.auth.getAuthorized(`me/access-grants?page=${page}&page_size=100`);
  }

  revoke(id: string, reason: string): Promise<AccessGrant> {
    return this.auth.postAuthorized(`access-grants/${encodeURIComponent(id)}/revoke`, { reason });
  }
}
