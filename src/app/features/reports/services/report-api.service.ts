import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import type { ApiPage } from '../../lab-upload-requests/services/lab-upload-request-api.service';

export interface SavedReport {
  id: string;
  patient_user_id: string;
  laboratory_id: string | null;
  document_id: string;
  report_type: string;
  report_date: string | null;
  lab_reference: string | null;
  notes: string | null;
  source: string;
  status: 'active' | 'superseded' | 'withdrawn';
  created_at: string;
}

export interface ReportUpload {
  patientId: string;
  file: File;
  reportType: string;
  reportDate: string | null;
  notes: string;
  requestId?: string;
  labReference?: string;
}

export interface ReportAttempt {
  input: ReportUpload;
  key: string;
  documentId?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportApi {
  private readonly auth = inject(AuthService);

  list(patientId: string | null, page: number): Promise<ApiPage<SavedReport>> {
    const path = patientId
      ? `patients/${encodeURIComponent(patientId)}/reports`
      : 'me/laboratory-reports';
    return this.auth.getAuthorized(`${path}?page=${page}&page_size=20`);
  }

  async upload(attempt: ReportAttempt, current: () => boolean): Promise<SavedReport> {
    const input = attempt.input;
    if (!current()) throw new Error('Account or laboratory changed.');
    if (!attempt.documentId) {
      const form = new FormData();
      form.set('file', input.file);
      form.set('document_type', 'report');
      if (input.requestId) {
        form.set('stage_for_report', 'true');
        form.set('upload_request_id', input.requestId);
      }
      const document = await this.auth.postAuthorizedForm<{ id: string }>(
        `patients/${encodeURIComponent(input.patientId)}/documents`,
        form,
      );
      attempt.documentId = document.id;
    }
    if (!current()) throw new Error('Account or laboratory changed.');
    return this.auth.postAuthorizedWithKey<SavedReport>(
      `patients/${encodeURIComponent(input.patientId)}/reports`,
      {
        document_id: attempt.documentId,
        report_type: input.reportType,
        report_date: input.reportDate?.trim() || null,
        notes: input.notes || null,
        ...(input.requestId
          ? { upload_request_id: input.requestId, lab_reference: input.labReference }
          : {}),
      },
      attempt.key,
    );
  }

  download(documentId: string): Promise<Blob> {
    return this.auth.getAuthorizedBlob(`documents/${encodeURIComponent(documentId)}/content`);
  }
}
