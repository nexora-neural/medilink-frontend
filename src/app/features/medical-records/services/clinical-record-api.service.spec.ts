import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth.service';
import { ClinicalRecordApiService } from './clinical-record-api.service';

describe('ClinicalRecordApiService', () => {
  const getAuthorized = vi.fn();
  const postAuthorized = vi.fn();
  let service: ClinicalRecordApiService;
  const record = {
    id: 'record-1',
    type: 'allergy',
    title: 'No known allergies',
    description: null,
    clinical_code: null,
    source: 'patient',
    recorded_by: 'patient-id',
    organization_id: null,
    status: 'active',
    recorded_at: '2026-11-22T12:00:00Z',
  };
  const page = (items: unknown[], p = 1, size = 100, total = items.length) => ({
    items,
    page: p,
    page_size: size,
    total,
  });
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getAuthorized, postAuthorized } }],
    });
    service = TestBed.inject(ClinicalRecordApiService);
  });

  it('maps raw provenance and forwards only allowed creation fields', async () => {
    getAuthorized.mockResolvedValue(page([record], 2, 20, 30));
    await expect(service.list('patient-id', 2)).resolves.toMatchObject({
      items: [
        {
          authorId: 'patient-id',
          organizationId: null,
          kind: 'allergy',
          recordedAt: record.recorded_at,
        },
      ],
      page: 2,
      pageSize: 20,
      total: 30,
    });
    expect(getAuthorized).toHaveBeenCalledWith(
      'patients/patient-id/clinical-records?page=2&page_size=20',
    );
    await service.add(
      'patient-id',
      { kind: 'note', title: 'Review', details: '', recordedAt: record.recorded_at },
      'consult-1',
    );
    expect(postAuthorized).toHaveBeenCalledExactlyOnceWith('patients/patient-id/clinical-records', {
      type: 'note',
      title: 'Review',
      description: null,
      recorded_at: record.recorded_at,
      consultation_id: 'consult-1',
    });
  });

  it.each([
    [[], 'unknown'],
    [[{ ...record, status: 'superseded' }], 'unknown'],
    [[{ ...record, recorded_by: 'another-user' }], 'unknown'],
    [[record], 'no-known-allergies'],
    [[{ ...record, title: 'Recorded allergen' }], 'allergies-recorded'],
  ])('derives the summary from active, attributed entries', async (items, status) => {
    getAuthorized.mockResolvedValue(page(items));
    await expect(service.allergyStatus('patient-id')).resolves.toBe(status);
  });

  it('reads later allergy pages before treating absence as definitive', async () => {
    getAuthorized
      .mockResolvedValueOnce(page([record], 1, 1, 2))
      .mockResolvedValueOnce(page([{ ...record, title: 'Recorded allergen' }], 2, 1, 2));
    await expect(service.allergyStatus('patient-id')).resolves.toBe('allergies-recorded');
    expect(getAuthorized).toHaveBeenLastCalledWith(
      'patients/patient-id/clinical-records?type=allergy&page=2&page_size=100',
    );
  });

  it('selects only current history grants and binds write permission to the correct consultation', async () => {
    const current = {
      patient: { patient_user_id: 'patient-id', display_name: 'Authorized Patient' },
      grant_id: 'grant-1',
      categories: ['history_allergies'],
      expires_at: '2099-01-01T00:00:00Z',
      allow_consultation: true,
    };
    const consult = {
      id: 'consult',
      patient_user_id: 'patient-id',
      doctor_user_id: 'doctor-id',
      grant_id: 'grant-1',
      started_at: '2026-01-01T00:00:00Z',
      ended_at: null,
    };
    getAuthorized
      .mockResolvedValueOnce(
        page([
          current,
          { ...current, categories: ['reports'] },
          { ...current, expires_at: '2000-01-01T00:00:00Z' },
        ]),
      )
      .mockResolvedValueOnce(
        page([
          { ...consult, id: 'wrong-author', doctor_user_id: 'foreign-doctor' },
          { ...consult, id: 'wrong-grant', grant_id: 'foreign-grant' },
          { ...consult, id: 'ended', ended_at: '2026-01-01T00:00:00Z' },
          consult,
        ]),
      );
    const [patient] = await service.patients();
    expect(patient.grants).toHaveLength(1);
    await expect(service.consultation(patient, 'doctor-id')).resolves.toEqual({
      id: 'consult',
      expiresAt: current.expires_at,
    });
    await expect(service.consultation({ ...patient, grants: [] }, 'doctor-id')).resolves.toBeNull();
    expect(getAuthorized).toHaveBeenCalledTimes(2);
  });
});
