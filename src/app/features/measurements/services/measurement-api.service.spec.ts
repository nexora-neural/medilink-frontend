import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth.service';
import { MeasurementApiService } from './measurement-api.service';

describe('MeasurementApiService integration', () => {
  const patientId = 'patient-123';
  const base = `patients/${patientId}/measurements`;

  const auth = {
    getOwnProfile: vi.fn(),
    getAuthorized: vi.fn(),
    postAuthorized: vi.fn(),
  };

  let service: MeasurementApiService;

  function measurement(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      patient_user_id: patientId,
      type: 'weight',
      value: 64,
      secondary_value: null,
      unit: 'lb',
      measured_at: '2026-10-20T04:00:00Z',
      recorded_by: patientId,
      source: 'patient',
      notes: null,
      status: 'active',
      supersedes_id: null,
      correction_reason: null,
      created_at: '2026-10-20T04:05:00Z',
      ...overrides,
    };
  }

  function page(items: unknown[], total = items.length) {
    return {
      items,
      page: 1,
      page_size: 100,
      total,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();

    TestBed.configureTestingModule({
      providers: [
        MeasurementApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(MeasurementApiService);
  });

  it('gets the patient ID from the authenticated profile', async () => {
    auth.getOwnProfile.mockResolvedValue({
      roles: ['patient'],
      patient_profile: { user_id: patientId },
    });

    await expect(service.getPatientId()).resolves.toBe(patientId);
  });

  it('loads current measurements and corrected history', async () => {
    const original = measurement('original', {
      status: 'superseded',
    });

    const corrected = measurement('corrected', {
      value: 66,
      status: 'active',
      supersedes_id: 'original',
      correction_reason: 'Corrected weight',
      created_at: '2026-10-21T04:05:00Z',
    });

    auth.getAuthorized.mockImplementation(async (path: string) => {
      if (path === `${base}?page=1&page_size=100`) {
        return page([corrected]);
      }

      if (path === `${base}/history?page=1&page_size=100`) {
        return page([corrected, original]);
      }

      throw new Error(`Unexpected API path: ${path}`);
    });

    const result = await service.load(patientId);

    expect(auth.getAuthorized).toHaveBeenCalledWith(`${base}?page=1&page_size=100`);

    expect(auth.getAuthorized).toHaveBeenCalledWith(`${base}/history?page=1&page_size=100`);

    expect(result.current).toHaveLength(1);
    expect(result.history).toHaveLength(2);

    expect(result.current[0].reading).toEqual({
      kind: 'weight',
      value: 66,
      unit: 'lb',
    });

    expect(result.current[0].rootId).toBe('original');
    expect(result.current[0].correctsId).toBe('original');

    expect(result.history[0].correctionReason).toBe('Corrected weight');

    expect(result.history[1].status).toBe('superseded');
    expect(result.historyUnavailable).toBe(false);
  });

  it('loads multiple history pages', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      measurement(`measurement-${index}`),
    );

    const secondPage = [measurement('measurement-100')];

    auth.getAuthorized.mockImplementation(async (path: string) => {
      if (path === `${base}?page=1&page_size=100`) {
        return page([]);
      }

      if (path === `${base}/history?page=1&page_size=100`) {
        return page(firstPage, 101);
      }

      if (path === `${base}/history?page=2&page_size=100`) {
        return {
          items: secondPage,
          page: 2,
          page_size: 100,
          total: 101,
        };
      }

      throw new Error(`Unexpected API path: ${path}`);
    });

    const result = await service.load(patientId);

    expect(result.history).toHaveLength(101);
    expect(auth.getAuthorized).toHaveBeenCalledWith(`${base}/history?page=2&page_size=100`);
  });

  it('keeps current measurements when history returns 503', async () => {
    auth.getAuthorized.mockImplementation(async (path: string) => {
      if (path === `${base}?page=1&page_size=100`) {
        return page([measurement('current')]);
      }

      throw new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
      });
    });

    const result = await service.load(patientId);

    expect(result.current).toHaveLength(1);
    expect(result.history).toEqual([]);
    expect(result.historyUnavailable).toBe(true);
  });

  it.each([401, 403])('does not hide history authorization error %i', async (status) => {
    auth.getAuthorized.mockImplementation(async (path: string) => {
      if (path === `${base}?page=1&page_size=100`) {
        return page([measurement('current')]);
      }

      throw new HttpErrorResponse({
        status,
        statusText: 'Access Denied',
      });
    });

    await expect(service.load(patientId)).rejects.toMatchObject({
      status,
    });
  });

  it('handles empty measurement history', async () => {
    auth.getAuthorized.mockResolvedValue(page([]));

    const result = await service.load(patientId);

    expect(result.current).toEqual([]);
    expect(result.history).toEqual([]);
    expect(result.historyUnavailable).toBe(false);
  });
});
