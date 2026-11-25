import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth.service';
import { AccessGrantsApiService } from './access-grants-api.service';

describe('AccessGrantsApiService', () => {
  const auth = {
    getAuthorized: vi.fn(),
    postAuthorized: vi.fn(),
  };
  let service: AccessGrantsApiService;

  beforeEach(() => {
    auth.getAuthorized.mockReset();
    auth.postAuthorized.mockReset();
    TestBed.configureTestingModule({
      providers: [AccessGrantsApiService, { provide: AuthService, useValue: auth }],
    });
    service = TestBed.inject(AccessGrantsApiService);
  });

  it('resolves the supplied doctor reference on the server', async () => {
    await service.resolveDoctor('opaque-reference');

    expect(auth.postAuthorized).toHaveBeenCalledWith('doctor-qr/resolve', {
      doctor_reference: 'opaque-reference',
    });
  });

  it('submits category, organization, duration, and consultation consent', async () => {
    const input: Parameters<AccessGrantsApiService['create']>[0] = {
      doctor_reference: 'opaque-reference',
      organization_id: 'clinic-id',
      categories: ['prescriptions'],
      duration_hours: 168,
      allow_consultation: true,
    };
    await service.create(input);

    expect(auth.postAuthorized).toHaveBeenCalledWith('access-grants', input);
  });

  it('loads the requested grant page from the patient-owned endpoint', async () => {
    await service.list(2);

    expect(auth.getAuthorized).toHaveBeenCalledWith('me/access-grants?page=2&page_size=100');
  });

  it('posts the required reason to the selected grant revocation endpoint', async () => {
    await service.revoke('grant/with spaces', 'Patient requested revocation');

    expect(auth.postAuthorized).toHaveBeenCalledWith('access-grants/grant%2Fwith%20spaces/revoke', {
      reason: 'Patient requested revocation',
    });
  });
});
