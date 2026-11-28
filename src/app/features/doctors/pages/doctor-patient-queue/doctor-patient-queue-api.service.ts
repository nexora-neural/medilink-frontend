// ML-70 live queue and consultation API.
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth.service';
export interface QueueEntry {
  patient: { patient_user_id: string; display_name: string; date_of_birth: string | null };
  grant_id: string;
  categories: string[];
  expires_at: string;
  allow_consultation: boolean;
}
export interface QueuePage {
  items: QueueEntry[];
  page: number;
  page_size: number;
  total: number;
}
export interface Consultation {
  id: string;
  patient_user_id: string;
  doctor_user_id: string;
  organization_id: string | null;
  grant_id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
}
@Injectable({ providedIn: 'root' })
export class DoctorPatientQueueApi {
  private readonly auth = inject(AuthService);
  list(page = 1): Promise<QueuePage> {
    return this.auth.getAuthorized(`me/patient-queue?page=${page}&page_size=100`);
  }
  start(grantId: string): Promise<Consultation> {
    return this.auth.postAuthorized('consultations', { grant_id: grantId });
  }
  end(id: string): Promise<Consultation> {
    return this.auth.postAuthorized(`consultations/${encodeURIComponent(id)}/end`, {});
  }
  listConsultations(
    patientId: string,
    page = 1,
  ): Promise<{ items: Consultation[]; page: number; page_size: number; total: number }> {
    return this.auth.getAuthorized(
      `patients/${encodeURIComponent(patientId)}/consultations?page=${page}&page_size=100`,
    );
  }
  listRecords(patientId: string): Promise<{
    items: Array<{
      id: string;
      type: string;
      title: string;
      description: string | null;
      recorded_at: string;
      source: string;
      status: string;
    }>;
    page: number;
    page_size: number;
    total: number;
  }> {
    return this.auth.getAuthorized(
      `patients/${encodeURIComponent(patientId)}/clinical-records?page=1&page_size=100`,
    );
  }
}
