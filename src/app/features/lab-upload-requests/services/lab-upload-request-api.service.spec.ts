import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth.service';
import { LabUploadRequestApi } from './lab-upload-request-api.service';

describe('LabUploadRequestApi', () => {
  const getAuthorized = vi.fn();
  const postAuthorized = vi.fn();

  let api: LabUploadRequestApi;

  beforeEach(() => {
    getAuthorized.mockReset();
    postAuthorized.mockReset();

    TestBed.configureTestingModule({
      providers: [
        LabUploadRequestApi,
        {
          provide: AuthService,
          useValue: {
            getAuthorized,
            postAuthorized,
          },
        },
      ],
    });

    api = TestBed.inject(LabUploadRequestApi);
  });

  it('loads laboratories with the laboratory filter and pagination', async () => {
    const response = {
      items: [
        {
          id: 'lab-01',
          name: 'Test Laboratory',
          type: 'laboratory',
        },
      ],
      page: 2,
      page_size: 20,
      total: 21,
    };

    getAuthorized.mockResolvedValue(response);

    const result = await api.listLaboratories(2);

    expect(getAuthorized).toHaveBeenCalledWith('organizations?type=laboratory&page=2&page_size=20');
    expect(result).toEqual(response);
  });

  it('encodes a trimmed laboratory search term', async () => {
    getAuthorized.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });

    await api.listLaboratories(1, '  Central & West  ');

    const path = getAuthorized.mock.calls[0][0] as string;
    const params = new URLSearchParams(path.split('?')[1]);

    expect(params.get('type')).toBe('laboratory');
    expect(params.get('q')).toBe('Central & West');
  });

  it('omits a blank laboratory search term', async () => {
    getAuthorized.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });

    await api.listLaboratories(1, '   ');

    const path = getAuthorized.mock.calls[0][0] as string;
    const params = new URLSearchParams(path.split('?')[1]);

    expect(params.has('q')).toBe(false);
  });

  it('loads the signed-in patient requests with pagination', async () => {
    const response = {
      items: [],
      page: 3,
      page_size: 20,
      total: 45,
    };

    getAuthorized.mockResolvedValue(response);

    expect(await api.listRequests(3)).toEqual(response);
    expect(getAuthorized).toHaveBeenCalledWith('me/lab-upload-requests?page=3&page_size=20');
  });

  it('creates a request using only the laboratory ID', async () => {
    const response = {
      request: { id: 'request-01' },
      request_token: 'synthetic-test-token',
    };

    postAuthorized.mockResolvedValue(response);

    expect(await api.createRequest('lab-01')).toEqual(response);
    expect(postAuthorized).toHaveBeenCalledWith('lab-upload-requests', {
      laboratory_id: 'lab-01',
    });
  });

  it('revokes a request with a trimmed reason', async () => {
    postAuthorized.mockResolvedValue({
      id: 'request-01',
      status: 'revoked',
    });

    await api.revokeRequest('request-01', '  Sent to the wrong lab  ');

    expect(postAuthorized).toHaveBeenCalledWith('lab-upload-requests/request-01/revoke', {
      reason: 'Sent to the wrong lab',
    });
  });

  it('encodes the request ID as a single path segment', async () => {
    postAuthorized.mockResolvedValue({});

    await api.revokeRequest('request/01', 'Test reason');

    expect(postAuthorized).toHaveBeenCalledWith('lab-upload-requests/request%2F01/revoke', {
      reason: 'Test reason',
    });
  });

  it('resolves a request by posting its laboratory ID and token', async () => {
    const response = {
      request_id: 'request-01',
      patient: {
        patient_user_id: 'patient-01',
        display_name: 'Synthetic Patient',
        date_of_birth: null,
      },
      laboratory_id: 'lab-01',
      expires_at: '2026-11-27T12:00:00Z',
    };

    postAuthorized.mockResolvedValue(response);

    expect(await api.resolveRequest('lab-01', 'synthetic-test-token')).toEqual(response);

    expect(postAuthorized).toHaveBeenCalledWith('lab-upload-requests/resolve', {
      laboratory_id: 'lab-01',
      request_token: 'synthetic-test-token',
    });
    expect(getAuthorized).not.toHaveBeenCalled();
  });

  it('passes lookup failures to the caller without returning sample data', async () => {
    const failure = new Error('Request unavailable');
    postAuthorized.mockRejectedValue(failure);

    await expect(api.resolveRequest('lab-01', 'synthetic-test-token')).rejects.toBe(failure);
  });
});
