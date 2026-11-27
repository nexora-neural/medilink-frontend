import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { DoctorPatientQueue } from './doctor-patient-queue';
import { DoctorPatientQueueApi } from './doctor-patient-queue-api.service';

const env = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};
const base = env.process?.env?.['ML70_E2E_API_URL'];
const token = env.process?.env?.['ML70_E2E_FIREBASE_TOKEN'];
async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base!.replace(/\/$/, '')}/api/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(value.message ?? `HTTP ${res.status}`), {
      status: res.status,
      error: value,
    });
  return value as T;
}
describe.skipIf(!base || !token)('ML-70 local PostgreSQL-backed queue E2E', () => {
  it('starts, refreshes, ends and refreshes an approved consultation', async () => {
    const service = {
      getAuthorized: <T>(path: string) => api<T>('GET', path),
      postAuthorized: <T>(path: string, body: unknown) => api<T>('POST', path, body),
    };
    TestBed.configureTestingModule({
      imports: [DoctorPatientQueue],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: AuthService, useValue: service },
        DoctorPatientQueueApi,
      ],
    });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false), { timeout: 15000 });
    const patient = f.componentInstance
      .patients()
      .find((p) => p.readAccess === 'active' && p.consultationPermission === 'granted');
    expect(
      patient,
      'doctor test account needs a synthetic active grant with consultation permission',
    ).toBeTruthy();
    await f.componentInstance.startConsultation(patient!.id);
    expect(f.componentInstance.patients().find((p) => p.id === patient!.id)?.status).toBe(
      'in-consultation',
    );
    f.destroy();
    const refreshed = TestBed.createComponent(DoctorPatientQueue);
    refreshed.detectChanges();
    await vi.waitFor(() => expect(refreshed.componentInstance.loading()).toBe(false), {
      timeout: 15000,
    });
    expect(refreshed.componentInstance.patients().find((p) => p.id === patient!.id)?.status).toBe(
      'in-consultation',
    );
    await refreshed.componentInstance.endConsultation(patient!.id);
    expect(refreshed.componentInstance.patients().find((p) => p.id === patient!.id)?.status).toBe(
      'completed',
    );
    refreshed.destroy();
    const final = TestBed.createComponent(DoctorPatientQueue);
    final.detectChanges();
    await vi.waitFor(() => expect(final.componentInstance.loading()).toBe(false), {
      timeout: 15000,
    });
    expect(final.componentInstance.patients().find((p) => p.id === patient!.id)?.status).toBe(
      'completed',
    );
    final.destroy();
  });
});
