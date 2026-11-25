import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { AccessGrantsApiService } from './access-grants-api.service';
import { PatientDoctorAccess } from './patient-doctor-access';

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};
const apiBaseUrl = runtime.process?.env?.['ML65_E2E_API_URL'];
const doctorReference = runtime.process?.env?.['ML65_E2E_DOCTOR_REFERENCE'];

async function localApiRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!apiBaseUrl) throw new Error('ML65_E2E_API_URL is required.');
  const url = new URL(`${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Local API returned ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

describe.skipIf(!apiBaseUrl || !doctorReference)('PatientDoctorAccess local full-stack E2E', () => {
  it('creates, reloads, and revokes a grant through the UI, API, and PostgreSQL', async () => {
    const auth = {
      getAuthorized: <T>(path: string) => localApiRequest<T>('GET', `api/v1/${path}`),
      postAuthorized: <T>(path: string, body: unknown) =>
        localApiRequest<T>('POST', `api/v1/${path}`, body),
    };
    await TestBed.configureTestingModule({
      imports: [PatientDoctorAccess],
      providers: [
        provideRouter([]),
        AccessGrantsApiService,
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PatientDoctorAccess);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await vi.waitFor(() => expect(component.grantsView()).toBe('ready'));
    const priorGrantIds = new Set(component.grants().map((item) => item.grant.id));

    component.codeForm.controls.doctorCode.setValue(doctorReference!);
    component.reviewCode();
    await vi.waitFor(() => expect(component.reviewStatus()).toBe('ready'));
    expect(component.resolvedDoctor()?.verification_status).toBe('approved');

    component.grantForm.patchValue({ reports: true, duration: '7d', confirmed: true });
    component.reviewGrantChoices();
    fixture.detectChanges();
    const grantButton = fixture.nativeElement.querySelector(
      '.grant-summary button',
    ) as HTMLButtonElement;
    expect(grantButton.textContent).toContain('Confirm and grant access');
    grantButton.click();

    await vi.waitFor(() =>
      expect(component.grants().some((item) => !priorGrantIds.has(item.grant.id))).toBe(true),
    );
    const grant = component.grants().find((item) => !priorGrantIds.has(item.grant.id))!;
    expect(grant.categories).toEqual(['reports']);
    expect(grant.grant.allow_consultation).toBe(false);
    expect(Date.parse(grant.grant.expires_at) - Date.parse(grant.grant.starts_at)).toBe(
      168 * 60 * 60 * 1000,
    );
    expect(component.grantSuccess()).toContain('successfully');

    component.requestRevoke(grant.grant.id);
    component.revokeReason.set('Synthetic E2E revocation');
    fixture.detectChanges();
    const revokeButton = fixture.nativeElement.querySelector(
      '.revoke-confirmation button.primary-button',
    ) as HTMLButtonElement;
    revokeButton.click();

    await vi.waitFor(() =>
      expect(
        component.grants().find((item) => item.grant.id === grant.grant.id)?.grant.status,
      ).toBe('revoked'),
    );
    expect(component.revokeMessage()).toContain('successfully');
    fixture.destroy();
  });
});
