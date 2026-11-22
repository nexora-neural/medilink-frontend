import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ActiveOrganizationService } from '../../../../core/context/active-organization.service';
import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import {
  LabUploadRequestApi,
  ResolvedUploadRequest,
} from '../../services/lab-upload-request-api.service';
import { LabRequestResolutionLive } from './lab-request-resolution-live';

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('LabRequestResolutionLive', () => {
  async function setup() {
    const activeRole = signal<ActiveRole>('Lab Staff');
    const activeAccountId = signal<string | null>('staff-a');
    const activeOrganizationId = signal<string | null>('lab-01');

    const response: ResolvedUploadRequest = {
      request_id: 'request-01',
      patient: {
        patient_user_id: 'patient-a',
        display_name: 'Synthetic Patient',
        date_of_birth: null,
      },
      laboratory_id: 'lab-01',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    const resolveRequest = vi.fn().mockResolvedValue(response);

    await TestBed.configureTestingModule({
      imports: [LabRequestResolutionLive],
      providers: [
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
            activeAccountId: activeAccountId.asReadonly(),
          },
        },
        {
          provide: ActiveOrganizationService,
          useValue: {
            activeOrganizationId: activeOrganizationId.asReadonly(),
          },
        },
        {
          provide: LabUploadRequestApi,
          useValue: { resolveRequest },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LabRequestResolutionLive);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      resolveRequest,
      response,
      activeRole,
      activeAccountId,
      activeOrganizationId,
    };
  }

  it('resolves a token using the selected laboratory', async () => {
    const { page, fixture, resolveRequest } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();
    fixture.detectChanges();

    expect(resolveRequest).toHaveBeenCalledWith('lab-01', 'synthetic-token');
    expect(page.resolved()?.patient.display_name).toBe('Synthetic Patient');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Synthetic Patient');
  });

  it('blocks lookup without a selected laboratory', async () => {
    const { page, fixture, activeOrganizationId, resolveRequest } = await setup();

    activeOrganizationId.set(null);
    fixture.detectChanges();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    expect(resolveRequest).not.toHaveBeenCalled();
    expect(page.resolved()).toBeNull();
  });

  for (const token of ['   ', 'x'.repeat(257)]) {
    it(`rejects an invalid token of length ${token.length}`, async () => {
      const { page, resolveRequest } = await setup();

      page.tokenControl.setValue(token);
      await page.resolve();

      expect(resolveRequest).not.toHaveBeenCalled();
      expect(page.error()).toContain('up to 256 characters');
    });
  }

  it('clears patient details when the token changes', async () => {
    const { page, fixture } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();
    expect(page.resolved()).not.toBeNull();

    page.tokenControl.setValue('different-token');
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Synthetic Patient');
  });

  it('does not restore patient details after a role round trip', async () => {
    const { page, fixture, activeRole } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    activeRole.set('Patient');
    fixture.detectChanges();

    activeRole.set('Lab Staff');
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();
    expect(page.tokenControl.value).toBe('');
  });

  it('clears patient details when the laboratory changes', async () => {
    const { page, fixture, activeOrganizationId } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    activeOrganizationId.set('lab-02');
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();
    expect(page.tokenControl.value).toBe('');
  });

  it('ignores a delayed response after the account changes', async () => {
    const { page, fixture, activeAccountId, resolveRequest, response } = await setup();

    const pending = deferred<ResolvedUploadRequest>();
    resolveRequest.mockReturnValue(pending.promise);

    page.tokenControl.setValue('synthetic-token');
    const operation = page.resolve();

    activeAccountId.set('staff-b');
    fixture.detectChanges();

    pending.resolve(response);
    await operation;

    expect(page.resolved()).toBeNull();
    expect(page.loading()).toBe(false);
  });

  it('ignores a delayed response after the laboratory changes', async () => {
    const { page, fixture, activeOrganizationId, resolveRequest, response } = await setup();

    const pending = deferred<ResolvedUploadRequest>();
    resolveRequest.mockReturnValue(pending.promise);

    page.tokenControl.setValue('synthetic-token');
    const operation = page.resolve();

    activeOrganizationId.set('lab-02');
    fixture.detectChanges();

    pending.resolve(response);
    await operation;

    expect(page.resolved()).toBeNull();
  });

  it('ignores a response after the token is edited', async () => {
    const { page, resolveRequest, response } = await setup();
    const pending = deferred<ResolvedUploadRequest>();
    resolveRequest.mockReturnValue(pending.promise);

    page.tokenControl.setValue('synthetic-token');
    const operation = page.resolve();

    page.tokenControl.setValue('different-token');
    pending.resolve(response);
    await operation;

    expect(page.resolved()).toBeNull();
  });

  it('rejects a response belonging to another laboratory', async () => {
    const { page, resolveRequest, response } = await setup();

    resolveRequest.mockResolvedValue({
      ...response,
      laboratory_id: 'lab-02',
    });

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    expect(page.resolved()).toBeNull();
    expect(page.error()).toContain('unavailable');
  });

  it('rejects an expired response', async () => {
    const { page, resolveRequest, response } = await setup();

    resolveRequest.mockResolvedValue({
      ...response,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    expect(page.resolved()).toBeNull();
  });

  it('hides resolved details at the expiry boundary', async () => {
    const { page, response } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();

    page.currentTime.set(Date.parse(response.expires_at));

    expect(page.resolved()).toBeNull();
  });

  for (const status of [403, 404, 429, 500]) {
    it(`shows an error without patient details for HTTP ${status}`, async () => {
      const { page, fixture, resolveRequest } = await setup();

      resolveRequest.mockRejectedValue(new HttpErrorResponse({ status }));

      page.tokenControl.setValue('synthetic-token');
      await page.resolve();
      fixture.detectChanges();

      expect(page.error()).not.toBe('');
      expect(page.resolved()).toBeNull();
      expect(page.loading()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Synthetic Patient');
    });
  }

  it('blocks duplicate lookup while a request is pending', async () => {
    const { page, resolveRequest, response } = await setup();
    const pending = deferred<ResolvedUploadRequest>();
    resolveRequest.mockReturnValue(pending.promise);

    page.tokenControl.setValue('synthetic-token');

    const first = page.resolve();
    await page.resolve();

    expect(resolveRequest).toHaveBeenCalledTimes(1);

    pending.resolve(response);
    await first;
  });

  it('clears the token and resolved details', async () => {
    const { page } = await setup();

    page.tokenControl.setValue('synthetic-token');
    await page.resolve();
    page.clear();

    expect(page.tokenControl.value).toBe('');
    expect(page.resolved()).toBeNull();
    expect(page.error()).toBe('');
  });
});
