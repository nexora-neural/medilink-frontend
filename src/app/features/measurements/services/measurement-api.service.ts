import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import {
  MeasurementDraft,
  MeasurementRecord,
  MeasurementReading,
  MeasurementSource,
} from '../models/measurement.model';

interface BackendMeasurement {
  id: string;
  patient_user_id: string;
  type: 'weight' | 'blood_pressure' | 'blood_glucose';
  value: number;
  secondary_value: number | null;
  unit: 'kg' | 'lb' | 'mmHg' | 'mg/dL' | 'mmol/L';
  measured_at: string;
  recorded_by: string;
  source: MeasurementSource;
  notes: string | null;
  status: 'active' | 'superseded' | 'entered_in_error';
  supersedes_id: string | null;
  correction_reason: string | null;
  created_at: string;
}
interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

function toRequest(draft: MeasurementDraft) {
  const r = draft.reading;
  return {
    value: r.kind === 'blood_pressure' ? r.systolic : r.value,
    ...(r.kind === 'blood_pressure' ? { secondary_value: r.diastolic } : {}),
    unit: r.unit,
    measured_at: draft.recordedAt,
  };
}

function toRecord(row: BackendMeasurement, roots: Map<string, string>): MeasurementRecord {
  const reading: MeasurementReading =
    row.type === 'blood_pressure'
      ? {
          kind: 'blood_pressure',
          systolic: row.value,
          diastolic: row.secondary_value!,
          unit: 'mmHg',
        }
      : row.type === 'blood_glucose'
        ? { kind: 'glucose', value: row.value, unit: row.unit as 'mg/dL' | 'mmol/L' }
        : { kind: 'weight', value: row.value, unit: row.unit as 'kg' | 'lb' };
  const rootId = row.supersedes_id ? (roots.get(row.supersedes_id) ?? row.supersedes_id) : row.id;
  roots.set(row.id, rootId);
  return {
    id: row.id,
    rootId,
    correctsId: row.supersedes_id,
    recordedAt: row.measured_at,
    createdAt: row.created_at,
    source: row.source,
    reading,
    correctionReason: row.correction_reason,
    status: row.status,
    recordedBy: row.recorded_by,
    notes: row.notes,
  };
}

@Injectable()
export class MeasurementApiService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  async getPatientId(): Promise<string> {
    const profile = await this.auth.getOwnProfile();
    if (!profile.patient_profile || !profile.roles.includes('patient')) {
      throw new Error('A patient profile is required to view measurements.');
    }
    return profile.patient_profile.user_id;
  }

  private async getAll(path: string): Promise<BackendMeasurement[]> {
    const result: BackendMeasurement[] = [];
    let page = 1;
    while (true) {
      const separator = path.includes('?') ? '&' : '?';
      const response = await this.auth.getAuthorized<Page<BackendMeasurement>>(
        `${path}${separator}page=${page}&page_size=100`,
      );
      result.push(...response.items);
      if (result.length >= response.total || response.items.length === 0) break;
      page++;
    }
    return result;
  }

  async load(
    patientId: string,
  ): Promise<{ current: MeasurementRecord[]; history: MeasurementRecord[] }> {
    const base = `patients/${encodeURIComponent(patientId)}/measurements`;
    const [active, history] = await Promise.all([
      this.getAll(base),
      this.getAll(`${base}/history`),
    ]);
    // Build correction chains in creation order, independent of API page order.
    const roots = new Map<string, string>();
    const all = [...history].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const mappedHistory = all.map((row) => toRecord(row, roots));
    const mappedCurrent = active.map((row) => toRecord(row, roots));
    return {
      current: mappedCurrent.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
      history: mappedHistory.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  async add(patientId: string, draft: MeasurementDraft): Promise<void> {
    await this.auth.postAuthorized<BackendMeasurement>(
      `patients/${encodeURIComponent(patientId)}/measurements`,
      {
        ...toRequest(draft),
        type: draft.reading.kind === 'glucose' ? 'blood_glucose' : draft.reading.kind,
      },
    );
  }

  async correct(measurementId: string,
                draft: MeasurementDraft,
                reason: string,
                idempotencyKey: string,
                ): Promise<void> {
    // The existing AuthService POST helper does not accept custom headers.
    // Use the same named Firebase app and runtime apiBaseUrl for the required idempotency header.
    const app = getApps().find((candidate) => candidate.name === 'medilink');
    if (!app || !window.medilinkConfig?.apiBaseUrl)
      throw new Error('Authentication is not configured.');
    const auth = getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('Please sign in to continue.');
    const token = await auth.currentUser.getIdToken();
    const url = `${window.medilinkConfig.apiBaseUrl}/measurements/${encodeURIComponent(measurementId)}/corrections`;
    await firstValueFrom(
      this.http
        .post<BackendMeasurement>(
          url,
          { ...toRequest(draft), reason },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': idempotencyKey,
            },
          },
        )
        .pipe(timeout(10000)),
    );
  }
}
