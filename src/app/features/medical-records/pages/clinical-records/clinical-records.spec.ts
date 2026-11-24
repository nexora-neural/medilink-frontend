import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { ClinicalEntry } from '../../models/clinical-record.model';
import { ClinicalRecordApiService, RecordPage } from '../../services/clinical-record-api.service';
import { ClinicalRecords } from './clinical-records';

describe('ClinicalRecords integration', () => {
  const original: ClinicalEntry = {
    id: 'entry-original',
    kind: 'diagnosis',
    title: 'Existing diagnosis',
    details: 'Recorded details',
    clinicalCode: 'TEST',
    recordedAt: '2026-11-22T12:00:00Z',
    source: 'doctor',
    authorId: 'other-doctor-id',
    organizationId: 'organization-id',
    status: 'superseded',
  };
  const api = {
    patients: vi.fn<ClinicalRecordApiService['patients']>(),
    list: vi.fn<ClinicalRecordApiService['list']>(),
    allergyStatus: vi.fn<ClinicalRecordApiService['allergyStatus']>(),
    consultation: vi.fn<ClinicalRecordApiService['consultation']>(),
    add: vi.fn<ClinicalRecordApiService['add']>(),
  };
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let fixture: ComponentFixture<ClinicalRecords>;
  let roles: ActiveRoleService;

  const page = (items: ClinicalEntry[], current = 1, total = items.length): RecordPage => ({
    items,
    page: current,
    pageSize: 20,
    total,
  });
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function configure(audience: 'doctor' | 'patient', selected = ''): void {
    query = new BehaviorSubject(convertToParamMap({ patient: selected }));
    TestBed.configureTestingModule({
      imports: [ClinicalRecords],
      providers: [
        provideRouter([]),
        { provide: ClinicalRecordApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { audience }, queryParamMap: query.value },
            queryParamMap: query.asObservable(),
          },
        },
      ],
    });
    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles(audience + '-id', [audience]);
    fixture = TestBed.createComponent(ClinicalRecords);
  }

  async function expectView(state: string): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.componentInstance.state().kind).toBe(state);
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue(page([original]));
    api.allergyStatus.mockResolvedValue('unknown');
    api.add.mockResolvedValue(undefined);
    api.consultation.mockResolvedValue(null);
    api.patients.mockResolvedValue([{ id: 'patient-id', name: 'Authorized Patient', grants: [] }]);
  });

  it('uses the signed-in patient and shows attributed, read-only records', async () => {
    configure('patient', 'different-patient');
    await expectView('ready');
    expect(api.list).toHaveBeenCalledExactlyOnceWith('patient-id', 1);
    expect(text()).toContain('Doctor-entered');
    expect(text()).toContain('Superseded');
    expect(text()).toContain('other-doctor-id');
    expect(text()).toContain('organization-id');
    expect(text()).not.toContain('Sample preview');
    expect(fixture.nativeElement.querySelector('time').getAttribute('datetime')).toBe(
      original.recordedAt,
    );
    expect(fixture.nativeElement.querySelector('article button')).toBeNull();
  });

  it('creates an own entry once and reloads from the server', async () => {
    configure('patient');
    await expectView('ready');
    const component = fixture.componentInstance;
    component.openForm();
    component.form.patchValue({ title: '  New condition  ', details: '  New details  ' });
    api.list.mockResolvedValue(
      page([{ ...original, id: 'new', title: 'New condition' }, original]),
    );
    component.save();
    component.save();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text()).toContain('Entry saved.');
      expect(text()).toContain('New condition');
    });
    expect(api.add).toHaveBeenCalledExactlyOnceWith(
      'patient-id',
      expect.objectContaining({
        kind: 'condition',
        title: 'New condition',
        details: 'New details',
      }),
      undefined,
    );
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('persists the explicit absence report when the status is unknown', async () => {
    api.list.mockResolvedValue(page([]));
    configure('patient');
    await expectView('ready');
    expect(text()).toContain('Unknown');
    expect(text()).toContain('No clinical entries yet');
    api.allergyStatus.mockResolvedValue('no-known-allergies');
    fixture.componentInstance.reportNoKnownAllergies();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text()).toContain('No known allergies reported.');
    });
    expect(api.add).toHaveBeenCalledExactlyOnceWith(
      'patient-id',
      expect.objectContaining({
        kind: 'allergy',
        title: 'No known allergies',
      }),
      undefined,
    );
    expect(text()).not.toContain('Report no known allergies');
  });

  it('retries a failed load and does not display raw errors', async () => {
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503, error: 'private' }));
    configure('patient');
    await expectView('error');
    expect(text()).toContain('Clinical records unavailable');
    expect(text()).not.toContain('private');
    fixture.componentInstance.refresh();
    await expectView('ready');
    expect(text()).toContain(original.title);
  });

  it.each([
    [401, 'expired'],
    [403, 'denied'],
    [404, 'denied'],
  ])('does not show record data on status %i', async (status, state) => {
    api.allergyStatus.mockRejectedValue(new HttpErrorResponse({ status }));
    configure('patient');
    await expectView(state);
    expect(text()).not.toContain(original.title);
  });

  it('never queries a doctor-selected ID that is outside the authorized queue', async () => {
    configure('doctor', 'unavailable-patient');
    await expectView('denied');
    expect(api.list).not.toHaveBeenCalled();
  });

  it('honors read-only access and has no edit control for another author', async () => {
    configure('doctor', 'patient-id');
    await expectView('ready');
    expect(text()).toContain('Read-only access');
    expect(text()).toContain(original.title);
    expect(fixture.componentInstance.canAdd()).toBe(false);
    fixture.componentInstance.openForm();
    expect(fixture.componentInstance.formOpen()).toBe(false);
    expect(api.add).not.toHaveBeenCalled();
  });

  it('appends doctor entries with the permitted consultation', async () => {
    api.consultation.mockResolvedValue({
      id: 'consultation-id',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    configure('doctor', 'patient-id');
    await expectView('ready');
    expect(api.consultation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'patient-id' }),
      'doctor-id',
    );
    const component = fixture.componentInstance;
    component.openForm();
    component.form.patchValue({ kind: 'note', title: 'Consultation follow-up' });
    component.save();
    await vi.waitFor(() =>
      expect(api.add).toHaveBeenCalledExactlyOnceWith(
        'patient-id',
        expect.objectContaining({
          kind: 'note',
          title: 'Consultation follow-up',
        }),
        'consultation-id',
      ),
    );
    await expectView('ready');
    expect(text()).toContain(original.title);
  });

  it('rechecks permissions following a rejected write', async () => {
    api.consultation.mockResolvedValue({
      id: 'consultation-id',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    configure('doctor', 'patient-id');
    await expectView('ready');
    const component = fixture.componentInstance;
    component.openForm();
    component.form.patchValue({ title: 'Write after revocation' });
    api.add.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    api.patients.mockResolvedValue([]);
    component.save();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text()).toContain('could not be saved because access changed');
      expect(text()).not.toContain(original.title);
    });
    await expectView('denied');
    expect(api.add).toHaveBeenCalledTimes(1);
  });

  it('validates blank titles and future dates before writing', async () => {
    configure('patient');
    await expectView('ready');
    const component = fixture.componentInstance;
    component.openForm();
    component.form.patchValue({ title: '   ' });
    component.save();
    expect(component.formError()).toContain('Enter a title');
    component.form.patchValue({ title: 'Valid title', recordedAt: '2099-01-01T00:00' });
    component.save();
    expect(component.formError()).toContain('not in the future');
    expect(api.add).not.toHaveBeenCalled();
  });

  it('does not render a late response after changing the account', async () => {
    let finish!: (value: RecordPage) => void;
    api.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    configure('patient');
    fixture.detectChanges();
    expect(fixture.componentInstance.state().kind).toBe('loading');
    roles.setAccountRoles('patient-2', ['patient']);
    api.list.mockResolvedValue(page([]));
    await expectView('ready');
    finish(page([original]));
    await fixture.whenStable();
    await expectView('ready');
    expect(text()).not.toContain(original.title);
    expect(api.list).toHaveBeenLastCalledWith('patient-2', 1);
  });

  it('switches pages without selecting a different patient or resetting the allergy summary', async () => {
    api.list.mockResolvedValue(page([original], 1, 23));
    api.allergyStatus.mockResolvedValue('allergies-recorded');
    configure('patient');
    await expectView('ready');
    api.list.mockResolvedValue(page([{ ...original, title: 'Older entry' }], 2, 23));
    fixture.componentInstance.changePage(2);
    await expectView('ready');
    expect(text()).toContain('Older entry');
    expect(text()).toContain('Allergies recorded.');
    expect(api.list).toHaveBeenLastCalledWith('patient-id', 2);
  });
});
