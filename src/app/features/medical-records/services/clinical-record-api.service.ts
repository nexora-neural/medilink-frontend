import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import {
  AllergyStatus,
  ClinicalEntry,
  ClinicalEntryDraft,
  NO_KNOWN_ALLERGIES,
} from '../models/clinical-record.model';

interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

interface RecordRead {
  id: string;
  type: ClinicalEntry['kind'];
  title: string;
  description: string | null;
  clinical_code: string | null;
  source: ClinicalEntry['source'];
  recorded_by: string;
  organization_id: string | null;
  status: ClinicalEntry['status'];
  recorded_at: string;
}

interface QueueRead {
  patient: { patient_user_id: string; display_name: string };
  grant_id: string;
  categories: string[];
  expires_at: string;
  allow_consultation: boolean;
}

interface ConsultationRead {
  id: string;
  patient_user_id: string;
  doctor_user_id: string;
  grant_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface RecordGrant {
  id: string;
  expiresAt: string;
  allowsConsultation: boolean;
}

export interface RecordPatient {
  id: string;
  name: string;
  grants: RecordGrant[];
}

export interface RecordConsultation {
  id: string;
  expiresAt: string;
}

export interface RecordPage {
  items: ClinicalEntry[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ClinicalRecordApiService {
  private readonly auth = inject(AuthService);

  async list(patient: string, page: number): Promise<RecordPage> {
    const result = await this.auth.getAuthorized<Page<RecordRead>>(
      `${this.path(patient)}?page=${page}&page_size=20`,
    );
    return {
      items: result.items.map((record) => this.toEntry(record)),
      page: result.page,
      pageSize: result.page_size,
      total: result.total,
    };
  }

  async allergyStatus(patient: string): Promise<AllergyStatus> {
    let explicitReport = false;
    for await (const row of this.pages<RecordRead>(this.path(patient), 'type=allergy&')) {
      if (row.status !== 'active') continue;

      if (row.title.trim().toLowerCase() === NO_KNOWN_ALLERGIES.toLowerCase()) {
        if (row.source === 'patient' && row.recorded_by === patient) explicitReport = true;
      } else {
        return 'allergies-recorded';
      }
    }
    return explicitReport ? 'no-known-allergies' : 'unknown';
  }

  async patients(): Promise<RecordPatient[]> {
    const patients = new Map<string, RecordPatient>();
    for await (const row of this.pages<QueueRead>('me/patient-queue')) {
      if (
        !row.categories.includes('history_allergies') ||
        !(Date.parse(row.expires_at) > Date.now())
      )
        continue;

      const { patient_user_id: id, display_name: name } = row.patient;
      const patient = patients.get(id) ?? { id, name, grants: [] };
      patient.grants.push({
        id: row.grant_id,
        expiresAt: row.expires_at,
        allowsConsultation: row.allow_consultation,
      });
      patients.set(id, patient);
    }
    return [...patients.values()];
  }

  async consultation(patient: RecordPatient, doctor: string): Promise<RecordConsultation | null> {
    const writableGrants = new Map(
      patient.grants.filter((grant) => grant.allowsConsultation).map((grant) => [grant.id, grant]),
    );
    if (!writableGrants.size) return null;

    for await (const row of this.pages<ConsultationRead>(
      `patients/${encodeURIComponent(patient.id)}/consultations`,
    )) {
      const grant = writableGrants.get(row.grant_id);
      const now = Date.now();
      if (
        grant &&
        row.patient_user_id === patient.id &&
        row.doctor_user_id === doctor &&
        row.ended_at === null &&
        Date.parse(row.started_at) <= now &&
        Date.parse(grant.expiresAt) > now
      ) {
        return { id: row.id, expiresAt: grant.expiresAt };
      }
    }
    return null;
  }

  async add(patient: string, entry: ClinicalEntryDraft, consultationId?: string): Promise<void> {
    await this.auth.postAuthorized<RecordRead>(this.path(patient), {
      type: entry.kind,
      title: entry.title,
      description: entry.details || null,
      recorded_at: entry.recordedAt,
      ...(consultationId ? { consultation_id: consultationId } : {}),
    });
  }

  private path(patient: string): string {
    return `patients/${encodeURIComponent(patient)}/clinical-records`;
  }

  private async *pages<T>(path: string, query = ''): AsyncGenerator<T> {
    for (let page = 1; ; page++) {
      const result = await this.auth.getAuthorized<Page<T>>(
        `${path}?${query}page=${page}&page_size=100`,
      );
      yield* result.items;
      if (!result.items.length || result.page * result.page_size >= result.total) return;
    }
  }

  private toEntry(record: RecordRead): ClinicalEntry {
    return {
      id: record.id,
      kind: record.type,
      title: record.title,
      details: record.description,
      clinicalCode: record.clinical_code,
      source: record.source,
      authorId: record.recorded_by,
      organizationId: record.organization_id,
      status: record.status,
      recordedAt: record.recorded_at,
    };
  }
}
