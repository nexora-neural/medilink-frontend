import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../core/context/active-role.service';
import {
  ApiPage,
  LaboratoryOption,
  LabUploadRequestApi,
  UploadRequestResponse,
} from './lab-upload-request-api.service';
import { PatientLabRequestState } from './patient-lab-request-state';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const labs: ApiPage<LaboratoryOption> = {
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
};

function requestPage(patientId: string): ApiPage<UploadRequestResponse> {
  return {
    items: [
      {
        id: `request-${patientId}`,
        patient_user_id: patientId,
        laboratory_id: 'lab-01',
        created_at: '2026-11-20T12:00:00Z',
        expires_at: '2026-11-27T12:00:00Z',
        status: 'active',
        used_at: null,
      },
    ],
    page: 1,
    page_size: 20,
    total: 1,
  };
}

describe('PatientLabRequestState', () => {
  function setup(initialRole: ActiveRole = 'Patient', initialAccount: string | null = 'patient-a') {
    const activeRole = signal<ActiveRole>(initialRole);
    const activeAccountId = signal<string | null>(initialAccount);

    const listLaboratories = vi.fn().mockResolvedValue(labs);
    const listRequests = vi.fn().mockResolvedValue(requestPage('patient-a'));

    TestBed.configureTestingModule({
      providers: [
        PatientLabRequestState,
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
            activeAccountId: activeAccountId.asReadonly(),
          },
        },
        {
          provide: LabUploadRequestApi,
          useValue: { listLaboratories, listRequests },
        },
      ],
    });

    const state = TestBed.inject(PatientLabRequestState);

    return {
      state,
      activeRole,
      activeAccountId,
      listLaboratories,
      listRequests,
    };
  }

  async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  }

  it('loads laboratories and the current patient requests', async () => {
    const { state, listLaboratories, listRequests } = setup();

    TestBed.tick();
    await settle();

    expect(listLaboratories).toHaveBeenCalledWith(1);
    expect(listRequests).toHaveBeenCalledWith(1);
    expect(state.state()).toBe('ready');
    expect(state.laboratories()).toEqual(labs.items);
    expect(state.requests()[0].patient_user_id).toBe('patient-a');
  });

  it('keeps data hidden while loading', async () => {
    const { state, listRequests } = setup();
    const pending = deferred<ApiPage<UploadRequestResponse>>();
    listRequests.mockReturnValue(pending.promise);

    TestBed.tick();

    expect(state.state()).toBe('loading');
    expect(state.requests()).toEqual([]);
    expect(state.laboratories()).toEqual([]);

    pending.resolve(requestPage('patient-a'));
    await settle();

    expect(state.state()).toBe('ready');
  });

  it('does not load without an account', () => {
    const { state, listRequests, listLaboratories } = setup('Patient', null);

    TestBed.tick();

    expect(state.state()).toBe('denied');
    expect(listRequests).not.toHaveBeenCalled();
    expect(listLaboratories).not.toHaveBeenCalled();
  });

  it('does not load for another role', () => {
    const { state, listRequests } = setup('Lab Staff');

    TestBed.tick();

    expect(state.state()).toBe('denied');
    expect(listRequests).not.toHaveBeenCalled();
  });

  it('clears loaded data when the role changes', async () => {
    const { state, activeRole } = setup();

    TestBed.tick();
    await settle();
    expect(state.requests()).toHaveLength(1);

    activeRole.set('Doctor');
    TestBed.tick();

    expect(state.state()).toBe('denied');
    expect(state.requests()).toEqual([]);
    expect(state.laboratories()).toEqual([]);
  });

  it('ignores the previous account response after switching accounts', async () => {
    const { state, activeAccountId, listRequests } = setup();
    const oldRequest = deferred<ApiPage<UploadRequestResponse>>();

    listRequests
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(requestPage('patient-b'));

    TestBed.tick();

    activeAccountId.set('patient-b');
    TestBed.tick();
    await settle();

    expect(state.requests()[0].patient_user_id).toBe('patient-b');

    oldRequest.resolve(requestPage('patient-a'));
    await settle();

    expect(state.requests()[0].patient_user_id).toBe('patient-b');
  });

  it('ignores a pending response after losing the permitted role', async () => {
    const { state, activeRole, listRequests } = setup();
    const pending = deferred<ApiPage<UploadRequestResponse>>();
    listRequests.mockReturnValue(pending.promise);

    TestBed.tick();

    activeRole.set('Doctor');
    TestBed.tick();

    pending.resolve(requestPage('patient-a'));
    await settle();

    expect(state.state()).toBe('denied');
    expect(state.requests()).toEqual([]);
  });

  for (const status of [401, 403]) {
    it(`shows denied access for HTTP ${status}`, async () => {
      const { state, listRequests } = setup();
      listRequests.mockRejectedValue(new HttpErrorResponse({ status }));

      TestBed.tick();
      await settle();

      expect(state.state()).toBe('denied');
      expect(state.requests()).toEqual([]);
      expect(state.laboratories()).toEqual([]);
    });
  }

  it('shows an error and supports retry after service failure', async () => {
    const { state, listRequests } = setup();

    listRequests.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

    TestBed.tick();
    await settle();

    expect(state.state()).toBe('error');
    expect(state.requests()).toEqual([]);

    await state.load();

    expect(state.state()).toBe('ready');
    expect(state.requests()).toHaveLength(1);
  });

  it('retains pagination metadata returned by the API', async () => {
    const { state, listRequests, listLaboratories } = setup();

    TestBed.tick();
    await settle();

    listLaboratories.mockResolvedValue({
      ...labs,
      page: 2,
      total: 25,
    });
    listRequests.mockResolvedValue({
      ...requestPage('patient-a'),
      page: 3,
      total: 46,
    });

    await state.load(2, 3);

    expect(listLaboratories).toHaveBeenLastCalledWith(2);
    expect(listRequests).toHaveBeenLastCalledWith(3);
    expect(state.laboratoryPage()).toBe(2);
    expect(state.laboratoryTotal()).toBe(25);
    expect(state.requestPage()).toBe(3);
    expect(state.requestTotal()).toBe(46);
  });

  it('ignores responses after the state service is destroyed', async () => {
    const { state, listRequests } = setup();
    const pending = deferred<ApiPage<UploadRequestResponse>>();
    listRequests.mockReturnValue(pending.promise);

    TestBed.tick();
    TestBed.resetTestingModule();

    pending.resolve(requestPage('patient-a'));
    await Promise.resolve();
    await Promise.resolve();

    expect(state.requests()).toEqual([]);
    expect(state.laboratories()).toEqual([]);
  });
});
