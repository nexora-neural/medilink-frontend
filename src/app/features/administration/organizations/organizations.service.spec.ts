import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let auth: { getAuthorized: ReturnType<typeof vi.fn>; postAuthorized: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { getAuthorized: vi.fn(), postAuthorized: vi.fn() };
    TestBed.configureTestingModule({
      providers: [OrganizationsService, { provide: AuthService, useValue: auth }],
    });
    service = TestBed.inject(OrganizationsService);
  });

  it('loads all organization pages', async () => {
    auth.getAuthorized
      .mockResolvedValueOnce({
        items: [{ id: 'org-1' }],
        page: 1,
        page_size: 100,
        total: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'org-2' }],
        page: 2,
        page_size: 100,
        total: 2,
      });

    await expect(service.listOrganizations()).resolves.toEqual([{ id: 'org-1' }, { id: 'org-2' }]);
    expect(auth.getAuthorized).toHaveBeenNthCalledWith(
      1,
      '/admin/organizations?page=1&page_size=100',
    );
    expect(auth.getAuthorized).toHaveBeenNthCalledWith(
      2,
      '/admin/organizations?page=2&page_size=100',
    );
  });

  it('filters memberships by organization and loads every result page', async () => {
    auth.getAuthorized.mockResolvedValueOnce({
      items: [{ id: 'membership-1' }],
      page: 1,
      page_size: 100,
      total: 1,
    });

    await expect(service.listMemberships('org-1')).resolves.toEqual([{ id: 'membership-1' }]);
    expect(auth.getAuthorized).toHaveBeenCalledWith(
      '/admin/memberships?organization_id=org-1&page=1&page_size=100',
    );
  });

  it('posts decisions with a trimmed reason', async () => {
    auth.postAuthorized.mockResolvedValue({ id: 'org-1', status: 'active' });

    await service.decideOrganization('org-1', 'active', '  Registration checked  ');

    expect(auth.postAuthorized).toHaveBeenCalledWith('admin/organizations/org-1/decision', {
      status: 'active',
      reason: 'Registration checked',
    });
  });
});
