import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

export type UploadRequestStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface LaboratoryOption {
  id: string;
  name: string;
  type: string;
}

export interface ApiPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface UploadRequestResponse {
  id: string;
  patient_user_id: string;
  laboratory_id: string;
  expires_at: string;
  status: UploadRequestStatus;
  created_at: string;
  used_at: string | null;
}

export interface CreatedUploadRequest {
  request: UploadRequestResponse;
  request_token: string;
}

export interface ResolvedUploadRequest {
  request_id: string;
  patient: {
    patient_user_id: string;
    display_name: string;
    date_of_birth: string | null;
  };
  laboratory_id: string;
  expires_at: string;
}

@Injectable({ providedIn: 'root' })
export class LabUploadRequestApi {
  private readonly auth = inject(AuthService);

  listLaboratories(page = 1, query = ''): Promise<ApiPage<LaboratoryOption>> {
    const params = new URLSearchParams({
      type: 'laboratory',
      page: String(page),
      page_size: '20',
    });

    const term = query.trim();
    if (term) {
      params.set('q', term);
    }

    return this.auth.getAuthorized<ApiPage<LaboratoryOption>>(`organizations?${params.toString()}`);
  }

  listRequests(page = 1): Promise<ApiPage<UploadRequestResponse>> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '20',
    });

    return this.auth.getAuthorized<ApiPage<UploadRequestResponse>>(
      `me/lab-upload-requests?${params.toString()}`,
    );
  }

  createRequest(laboratoryId: string): Promise<CreatedUploadRequest> {
    return this.auth.postAuthorized<CreatedUploadRequest>('lab-upload-requests', {
      laboratory_id: laboratoryId,
    });
  }

  revokeRequest(requestId: string, reason: string): Promise<UploadRequestResponse> {
    return this.auth.postAuthorized<UploadRequestResponse>(
      `lab-upload-requests/${encodeURIComponent(requestId)}/revoke`,
      {
        reason: reason.trim(),
      },
    );
  }

  resolveRequest(laboratoryId: string, requestToken: string): Promise<ResolvedUploadRequest> {
    return this.auth.postAuthorized<ResolvedUploadRequest>('lab-upload-requests/resolve', {
      laboratory_id: laboratoryId,
      request_token: requestToken,
    });
  }
}
