import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth.service';
import { DoctorPatientQueueApi } from './doctor-patient-queue-api.service';

describe('DoctorPatientQueueApi', () => {
  const auth = { getAuthorized: vi.fn(), postAuthorized: vi.fn() };
  let api: DoctorPatientQueueApi;
  beforeEach(() => {
    auth.getAuthorized.mockReset();
    auth.postAuthorized.mockReset();
    TestBed.configureTestingModule({
      providers: [DoctorPatientQueueApi, { provide: AuthService, useValue: auth }],
    });
    api = TestBed.inject(DoctorPatientQueueApi);
  });
  it('loads paged verified queue entries', async () => {
    await api.list(2);
    expect(auth.getAuthorized).toHaveBeenCalledWith('me/patient-queue?page=2&page_size=100');
  });
  it('starts consultation using only the server issued grant id', async () => {
    await api.start('grant-id');
    expect(auth.postAuthorized).toHaveBeenCalledWith('consultations', { grant_id: 'grant-id' });
  });
  it('ends a selected consultation without client-supplied status', async () => {
    await api.end('consultation/id');
    expect(auth.postAuthorized).toHaveBeenCalledWith('consultations/consultation%2Fid/end', {});
  });
  it('loads the doctor authorized consultation history', async () => {
    await api.listConsultations('patient/id', 3);
    expect(auth.getAuthorized).toHaveBeenCalledWith(
      'patients/patient%2Fid/consultations?page=3&page_size=100',
    );
  });
});
