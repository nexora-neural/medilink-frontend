import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { IntegrationClientsApiService } from './integration-clients-api.service';

describe('IntegrationClientsApiService', () => {
  let service: IntegrationClientsApiService;
  const getAuthorized = vi.fn();
  const postAuthorized = vi.fn();
  const listOrganizations = vi.fn();
  const listPublicOrganizations = vi.fn();
  const path = '/admin/integration-clients';
  const expiresAt = '2030-01-01T00:00:00Z';
  const client = {
    id: 'client-1',
    organization_id: 'lab-1',
    name: 'Report uploader',
    status: 'active',
    scopes: ['reports:write'],
    expires_at: expiresAt,
  };

  beforeEach(() => {
    getAuthorized.mockReset();
    postAuthorized.mockReset();
    listOrganizations.mockReset().mockResolvedValue([{ id: 'lab-1', name: 'Central Lab' }]);
    listPublicOrganizations.mockReset();
    TestBed.configureTestingModule({
      providers: [
        IntegrationClientsApiService,
        { provide: AuthService, useValue: { getAuthorized, postAuthorized } },
        { provide: OrganizationsService, useValue: { listOrganizations, listPublicOrganizations } },
      ],
    });
    service = TestBed.inject(IntegrationClientsApiService);
  });

  it('loads all pages and resolves organization names without exposing a credential', async () => {
    getAuthorized
      .mockResolvedValueOnce({
        items: [{ ...client, credential: 'unexpected' }],
        page: 1,
        page_size: 1,
        total: 2,
      })
      .mockResolvedValueOnce({
        items: [{ ...client, id: 'client-2', status: 'pending', scopes: [] }],
        page: 2,
        page_size: 1,
        total: 2,
      });

    const clients = await service.listClients();

    expect(getAuthorized.mock.calls).toEqual([
      [`${path}?page=1&page_size=100`],
      [`${path}?page=2&page_size=100`],
    ]);
    expect(clients).toHaveLength(2);
    expect(clients[0]).toEqual({
      id: 'client-1',
      organizationId: 'lab-1',
      organizationName: 'Central Lab',
      name: 'Report uploader',
      status: 'active',
      scopes: ['reports:write'],
      expiresAt,
    });
    expect(clients[1]).toMatchObject({ scopes: [], status: 'pending' });
  });

  it('selects active laboratories from the public organizations source', async () => {
    listPublicOrganizations.mockResolvedValue([
      { id: 'lab-1', name: 'Central Lab', type: 'laboratory' },
      { id: 'clinic-1', name: 'Central Clinic', type: 'clinic' },
    ]);

    await expect(service.listApprovedLabs()).resolves.toEqual([
      { id: 'lab-1', name: 'Central Lab' },
    ]);
  });

  it('sends the creation payload and exposes the credential only in the write result', async () => {
    postAuthorized.mockResolvedValue({ client, credential: 'test-credential' });

    const result = await service.approve({
      organizationId: 'lab-1',
      name: '  Report uploader  ',
      scopes: ['reports:write'],
      expiresAt,
    });
    expect(postAuthorized).toHaveBeenCalledWith(path, {
      organization_id: 'lab-1',
      name: 'Report uploader',
      scopes: ['reports:write'],
      expires_at: expiresAt,
    });
    expect(result.credential).toBe('test-credential');
    expect(result.client).not.toHaveProperty('credential');

    getAuthorized.mockResolvedValue({ items: [client], page: 1, page_size: 100, total: 1 });
    const refreshedClients = await service.listClients();
    expect(refreshedClients[0]).toMatchObject({ id: result.client.id });
    expect(refreshedClients[0]).not.toHaveProperty('credential');
  });

  it('sends reason and expiry when rotating', async () => {
    postAuthorized.mockResolvedValue({ client, credential: 'rotated-test-credential' });

    const result = await service.change('client-1', 'rotate', '  Scheduled rotation  ', expiresAt);

    expect(postAuthorized).toHaveBeenCalledWith(`${path}/client-1/rotate`, {
      reason: 'Scheduled rotation',
      expires_at: expiresAt,
    });
    expect(result).toHaveProperty('credential', 'rotated-test-credential');
  });

  it.each([
    ['suspend', 'suspended'],
    ['revoke', 'revoked'],
  ] as const)('sends the audit reason for %s', async (action, status) => {
    postAuthorized.mockResolvedValue({ ...client, status });

    await expect(service.change('client-1', action, '  Admin decision  ')).resolves.toMatchObject({
      id: 'client-1',
      status,
    });
    expect(postAuthorized).toHaveBeenCalledWith(`${path}/client-1/${action}`, {
      reason: 'Admin decision',
    });
  });

  it('projects only the submission fields used by the screen', async () => {
    const receivedAt = '2026-11-20T10:00:00Z';
    getAuthorized.mockResolvedValue({
      items: [
        {
          id: 'submission-1',
          client_id: 'client-1',
          status: 'accepted',
          received_at: receivedAt,
          error_code: null,
          external_report_id: 'external-1',
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
    });

    await expect(service.listSubmissions()).resolves.toEqual([
      { id: 'submission-1', clientId: 'client-1', status: 'accepted', receivedAt, errorCode: null },
    ]);
  });

  it.each([401, 403, 503])('passes HTTP %i to the caller', async (status) => {
    const error = new HttpErrorResponse({ status });
    getAuthorized.mockRejectedValue(error);

    await expect(service.listClients()).rejects.toBe(error);
    expect(listOrganizations).not.toHaveBeenCalled();
  });
});
