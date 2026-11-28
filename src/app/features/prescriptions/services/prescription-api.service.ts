import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import {
  PrescriptionDetailPageResponse,
  PrescriptionDetailResponse,
  PrescriptionInput,
} from '../models/prescription-api.model';

@Injectable({ providedIn: 'root' })
export class PrescriptionApiService {
  private readonly auth = inject(AuthService);

  list(patientId: string, page = 1, pageSize = 20): Promise<PrescriptionDetailPageResponse> {
    const patient = encodeURIComponent(patientId);

    return this.auth.getAuthorized<PrescriptionDetailPageResponse>(
      `patients/${patient}/prescriptions?page=${page}&page_size=${pageSize}`,
    );
  }

  get(prescriptionId: string): Promise<PrescriptionDetailResponse> {
    return this.auth.getAuthorized<PrescriptionDetailResponse>(
      `prescriptions/${encodeURIComponent(prescriptionId)}`,
    );
  }

  create(patientId: string, payload: PrescriptionInput): Promise<PrescriptionDetailResponse> {
    return this.auth.postAuthorized<PrescriptionDetailResponse>(
      `patients/${encodeURIComponent(patientId)}/prescriptions`,
      payload,
    );
  }
  update(
    prescriptionId: string,
    version: number,
    payload: PrescriptionInput,
  ): Promise<PrescriptionDetailResponse> {
    return this.auth.putAuthorized<PrescriptionDetailResponse>(
      `prescriptions/${encodeURIComponent(prescriptionId)}/draft`,
      payload,
      { 'If-Match': String(version) },
    );
  }

  deleteDraft(prescriptionId: string): Promise<void> {
    return this.auth.deleteAuthorized<void>(
      `prescriptions/${encodeURIComponent(prescriptionId)}/draft`,
    );
  }
}
