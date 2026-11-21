import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import {
  CreatedUploadRequest,
  LabUploadRequestApi,
  UploadRequestResponse,
} from '../../services/lab-upload-request-api.service';
import { PatientLabRequestsLive } from './patient-lab-requests-live';

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('PatientLabRequestsLive', () => {
  async function setup() {
    const activeRole = signal<ActiveRole>('Patient');
    const activeAccountId = signal<string | null>('patient-a');

    const request: UploadRequestResponse = {
      id: 'request-01',
      patient_user_id: 'patient-a',
      laboratory_id: 'lab-01',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active',
      used_at: null,
    };

    const created: CreatedUploadRequest = {
      request,
      request_token: 'synthetic-test-token',
    };

    const api = {
      listLaboratories: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'lab-01',
            name: 'Synthetic Laboratory',
            type: 'laboratory',
          },
        ],
        page: 1,
        page_size: 20,
        total: 1,
      }),
      listRequests: vi.fn().mockResolvedValue({
        items: [request],
        page: 1,
        page_size: 20,
        total: 1,
      }),
      createRequest: vi.fn().mockResolvedValue(created),
      revokeRequest: vi.fn().mockResolvedValue({
        ...request,
        status: 'revoked',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [PatientLabRequestsLive],
      providers: [
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
            activeAccountId: activeAccountId.asReadonly(),
          },
        },
        {
          provide: LabUploadRequestApi,
          useValue: api,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PatientLabRequestsLive);
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(fixture.componentInstance.data.state()).toBe('ready');
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      api,
      request,
      created,
      activeRole,
      activeAccountId,
    };
  }

  it('renders laboratories and requests returned by the API', async () => {
    const { fixture } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('Synthetic Laboratory');
    expect(text).toContain('request-01');
    expect(text).not.toContain('Sample preview only');
  });

  it('blocks creation without a laboratory selection', async () => {
    const { page, api } = await setup();

    await page.createRequest();

    expect(api.createRequest).not.toHaveBeenCalled();
    expect(page.createError()).toContain('Select an available laboratory');
  });

  it('creates a request and displays the returned token', async () => {
    const { page, fixture, api } = await setup();

    page.labControl.setValue('lab-01');
    await page.createRequest();
    fixture.detectChanges();

    expect(api.createRequest).toHaveBeenCalledWith('lab-01');
    expect(page.createdToken()).toBe('synthetic-test-token');

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '#created-request-token',
    ) as HTMLInputElement;

    expect(input.value).toBe('synthetic-test-token');
    expect(input.readOnly).toBe(true);
    expect(api.listRequests).toHaveBeenCalledTimes(2);
  });

  it('blocks duplicate creation while a request is pending', async () => {
    const { page, api, created } = await setup();
    const pending = deferred<CreatedUploadRequest>();
    api.createRequest.mockReturnValue(pending.promise);

    page.labControl.setValue('lab-01');

    const first = page.createRequest();
    await page.createRequest();

    expect(api.createRequest).toHaveBeenCalledTimes(1);

    pending.resolve(created);
    await first;
  });

  it('does not display an old create response after switching accounts', async () => {
    const { page, fixture, api, created, activeAccountId } = await setup();
    const pending = deferred<CreatedUploadRequest>();
    api.createRequest.mockReturnValue(pending.promise);

    page.labControl.setValue('lab-01');
    const operation = page.createRequest();

    activeAccountId.set('patient-b');
    fixture.detectChanges();
    await fixture.whenStable();

    pending.resolve(created);
    await operation;
    fixture.detectChanges();

    expect(page.createdToken()).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#created-request-token'),
    ).toBeNull();
  });

  it('clears the token when the role changes and does not restore it', async () => {
    const { page, fixture, activeRole } = await setup();

    page.labControl.setValue('lab-01');
    await page.createRequest();

    activeRole.set('Doctor');
    fixture.detectChanges();
    await fixture.whenStable();

    activeRole.set('Patient');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.createdToken()).toBeNull();
  });

  it('requires a nonblank revocation reason', async () => {
    const { page, api } = await setup();

    page.requestRevoke('request-01');
    page.reasonControl.setValue('   ');
    await page.confirmRevoke();

    expect(api.revokeRequest).not.toHaveBeenCalled();
    expect(page.revokeError()).toContain('Enter a reason');
  });

  it('cancels revocation without calling the API', async () => {
    const { page, api } = await setup();

    page.requestRevoke('request-01');
    page.cancelRevoke();

    expect(page.pendingRevokeId()).toBeNull();
    expect(api.revokeRequest).not.toHaveBeenCalled();
  });

  it('revokes the selected request with a trimmed reason', async () => {
    const { page, api, request } = await setup();

    api.listRequests.mockResolvedValue({
      items: [{ ...request, status: 'revoked' }],
      page: 1,
      page_size: 20,
      total: 1,
    });

    page.requestRevoke('request-01');
    page.reasonControl.setValue('  Wrong laboratory  ');
    await page.confirmRevoke();

    expect(api.revokeRequest).toHaveBeenCalledWith('request-01', 'Wrong laboratory');
    expect(page.pendingRevokeId()).toBeNull();
    expect(page.data.requests()[0].status).toBe('revoked');
  });

  it('rechecks expiry before revoking', async () => {
    const { page, api, request } = await setup();

    page.requestRevoke('request-01');
    page.reasonControl.setValue('Test reason');

    page.data.requests.set([
      {
        ...request,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ]);

    await page.confirmRevoke();

    expect(api.revokeRequest).not.toHaveBeenCalled();
    expect(page.pendingRevokeId()).toBeNull();
  });

  it('clears pending confirmation after a role round trip', async () => {
    const { page, fixture, activeRole } = await setup();

    page.requestRevoke('request-01');
    expect(page.selectedRevoke()).not.toBeNull();

    activeRole.set('Doctor');
    fixture.detectChanges();
    await fixture.whenStable();

    activeRole.set('Patient');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.pendingRevokeId()).toBeNull();
    expect(page.selectedRevoke()).toBeNull();
    expect(page.reasonControl.value).toBe('');
  });

  it('clears request data when revocation returns access denied', async () => {
    const { page, api } = await setup();

    api.revokeRequest.mockRejectedValue(new HttpErrorResponse({ status: 403 }));

    page.requestRevoke('request-01');
    page.reasonControl.setValue('Test reason');
    await page.confirmRevoke();

    expect(page.data.state()).toBe('denied');
    expect(page.data.requests()).toEqual([]);
    expect(page.pendingRevokeId()).toBeNull();
    expect(page.createdToken()).toBeNull();
  });
});
