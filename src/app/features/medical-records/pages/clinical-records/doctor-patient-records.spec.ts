import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { ClinicalRecordApiService, RecordPage } from '../../services/clinical-record-api.service';
import { ClinicalRecords } from './clinical-records';
import { DoctorPatientRecords } from './doctor-patient-records';

describe('doctor queue direct patient records after the ML-74 merge', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let roles: ActiveRoleService;
  let fixture: ComponentFixture<DoctorPatientRecords>;
  const row = (title: string): RecordPage => ({
    items: [
      {
        id: title,
        kind: 'diagnosis',
        title,
        details: 'Authorized server record',
        clinicalCode: 'TEST',
        recordedAt: '2026-11-26T00:00:00Z',
        source: 'doctor',
        authorId: 'author-42',
        organizationId: 'org-42',
        status: 'entered_in_error',
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  });
  const api = {
    list: vi.fn<ClinicalRecordApiService['list']>(),
    allergyStatus: vi.fn<ClinicalRecordApiService['allergyStatus']>(),
    patients: vi.fn(),
    consultation: vi.fn(),
    add: vi.fn(),
  };
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: 'patient-42' }));
    Object.values(api).forEach((mock) => mock.mockReset());
    api.list.mockResolvedValue(row('Server diagnosis'));
    api.allergyStatus.mockResolvedValue('unknown');
    TestBed.configureTestingModule({
      imports: [DoctorPatientRecords, ClinicalRecords],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { audience: 'doctor', livePatientRecords: true },
              paramMap: params.value,
              queryParamMap: convertToParamMap({}),
            },
            paramMap: params.asObservable(),
            queryParamMap: new BehaviorSubject(convertToParamMap({})).asObservable(),
          },
        },
        { provide: ClinicalRecordApiService, useValue: api },
      ],
    });
    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('doctor-account', ['doctor']);
  });
  async function settle() {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.componentInstance.state().kind).not.toBe('loading');
    });
  }
  async function create() {
    fixture = TestBed.createComponent(DoctorPatientRecords);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  }
  const text = () => fixture.nativeElement.textContent as string;
  it('loads the authorized patient with source/author/status and no write controls', async () => {
    await create();
    expect(api.list).toHaveBeenCalledWith('patient-42', 1);
    expect(text()).toContain('Server diagnosis');
    expect(text()).toContain('author-42');
    expect(text()).toContain('org-42');
    expect(text()).toContain('Entered in error');
    expect(text()).toContain('Read-only record');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(text()).not.toContain('Sample preview');
    expect(api.patients).not.toHaveBeenCalled();
    expect(api.consultation).not.toHaveBeenCalled();
    expect(api.add).not.toHaveBeenCalled();
  });
  it('shows a genuinely empty read-only result with no sample-add control', async () => {
    api.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await create();
    expect(text()).toContain('No clinical entries are available for this patient.');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(text()).not.toContain('Add sample entry');
  });
  it('clears records immediately when switching patients and ignores a delayed older response', async () => {
    let resolveA!: (page: RecordPage) => void;
    let resolveB!: (page: RecordPage) => void;
    params.next(convertToParamMap({ id: 'patient-a' }));
    api.list.mockImplementation(
      (id) =>
        new Promise((resolve) => {
          if (id === 'patient-a') resolveA = resolve;
          else resolveB = resolve;
        }),
    );
    fixture = TestBed.createComponent(DoctorPatientRecords);
    fixture.detectChanges();
    params.next(convertToParamMap({ id: 'patient-b' }));
    expect(fixture.componentInstance.entries()).toEqual([]);
    fixture.detectChanges();
    resolveB(row('Patient B'));
    await settle();
    fixture.detectChanges();
    expect(text()).toContain('Patient B');
    resolveA(row('Patient A'));
    await settle();
    fixture.detectChanges();
    expect(text()).not.toContain('Patient A');
    expect(text()).toContain('Patient B');
  });
  it.each([403, 404])('keeps denied records hidden for status %i', async (status) => {
    api.list.mockRejectedValue(new HttpErrorResponse({ status, error: 'PRIVATE-SERVER-DETAIL' }));
    await create();
    expect(text()).toContain('not granted access');
    expect(text()).not.toMatch(/Server diagnosis|PRIVATE|Asthma/);
    expect(fixture.componentInstance.entries()).toEqual([]);
  });
  it('shows a sign-in link for expired sessions', async () => {
    api.list.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    await create();
    expect(text()).toContain('Session expired');
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
  });
  it('retries a service failure without retaining previous records', async () => {
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await create();
    expect(text()).toContain('Clinical records unavailable');
    fixture.nativeElement.querySelector('app-ui-state button').click();
    await settle();
    fixture.detectChanges();
    expect(text()).toContain('Server diagnosis');
  });
  it('clears the previous account immediately and does not fetch without the Doctor role', async () => {
    await create();
    roles.clear();
    expect(fixture.componentInstance.entries()).toEqual([]);
    fixture.detectChanges();
    await settle();
    expect(text()).not.toContain('Server diagnosis');
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('ignores a response after component destruction', async () => {
    let resolve!: (page: RecordPage) => void;
    api.list.mockImplementation(() => new Promise((r) => (resolve = r)));
    fixture = TestBed.createComponent(DoctorPatientRecords);
    fixture.detectChanges();
    fixture.destroy();
    resolve(row('Late patient'));
    await Promise.resolve();
    expect(fixture.componentInstance.entries()).toEqual([]);
  });
  it('pages server records while keeping the direct patient route read-only', async () => {
    api.list.mockResolvedValue({ ...row('First page'), total: 30 });
    await create();
    api.list.mockResolvedValue({ ...row('Second page'), page: 2, total: 30 });
    fixture.componentInstance.changePage(2);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith('patient-42', 2);
    expect(text()).toContain('Second page');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
  it('preserves the queue route through the shared component without duplicate writable-flow requests', async () => {
    const parent = TestBed.createComponent(ClinicalRecords);
    parent.detectChanges();
    await vi.waitFor(() => {
      parent.detectChanges();
      expect(parent.nativeElement.textContent).toContain('Server diagnosis');
    });
    expect(parent.nativeElement.querySelector('app-doctor-patient-records')).not.toBeNull();
    expect(parent.nativeElement.textContent).toContain('Server diagnosis');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.patients).not.toHaveBeenCalled();
    expect(api.consultation).not.toHaveBeenCalled();
    expect(api.add).not.toHaveBeenCalled();
    expect(parent.componentInstance.canAdd()).toBe(false);
  });
});
