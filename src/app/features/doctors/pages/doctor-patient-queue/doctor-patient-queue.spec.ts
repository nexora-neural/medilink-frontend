import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorPatientQueue } from './doctor-patient-queue';
import { DoctorPatientQueueApi } from './doctor-patient-queue-api.service';

describe('DoctorPatientQueue', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const api = { list: vi.fn(), start: vi.fn(), end: vi.fn(), listConsultations: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    queryParamMap.next(convertToParamMap({}));
    api.list.mockResolvedValue({
      items: [
        {
          patient: {
            patient_user_id: 'p1',
            display_name: 'Synthetic Patient',
            date_of_birth: null,
          },
          grant_id: 'g1',
          categories: ['reports'],
          expires_at: '2099-01-01T00:00:00Z',
          allow_consultation: true,
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
    });
    api.listConsultations.mockResolvedValue({ items: [], page: 1, page_size: 100, total: 0 });
    await TestBed.configureTestingModule({
      imports: [DoctorPatientQueue],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap.asObservable() } },
        { provide: DoctorPatientQueueApi, useValue: api },
      ],
    }).compileComponents();
  });
  it('loads only server queue entries and displays granted permissions', async () => {
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    f.detectChanges();
    expect(api.list).toHaveBeenCalledOnce();
    expect(f.nativeElement.textContent).toContain('Synthetic Patient');
    expect(f.nativeElement.textContent).toContain('Granted');
    expect(f.nativeElement.textContent).not.toContain('Nadeesha Perera');
  });
  it('combines multiple grants for one patient and starts with a consultable grant', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          patient: {
            patient_user_id: 'p1',
            display_name: 'Synthetic Patient',
            date_of_birth: null,
          },
          grant_id: 'read-only-grant',
          categories: ['reports'],
          expires_at: '2099-01-01T00:00:00Z',
          allow_consultation: false,
        },
        {
          patient: {
            patient_user_id: 'p1',
            display_name: 'Synthetic Patient',
            date_of_birth: null,
          },
          grant_id: 'consult-grant',
          categories: ['history_allergies'],
          expires_at: '2099-01-01T00:00:00Z',
          allow_consultation: true,
        },
      ],
      page: 1,
      page_size: 100,
      total: 2,
    });
    api.start.mockResolvedValue({ id: 'consultation-1', ended_at: null });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    f.detectChanges();
    expect(f.componentInstance.patients()).toHaveLength(1);
    expect(f.nativeElement.querySelectorAll('article.patient-item')).toHaveLength(1);
    expect(f.componentInstance.patients()[0].consultationContext).toBe(
      'reports, history_allergies',
    );
    await f.componentInstance.startConsultation('p1');
    expect(api.start).toHaveBeenCalledWith('consult-grant');
  });
  it('starts and ends consultation only after server confirmation', async () => {
    api.start.mockResolvedValue({ id: 'c1', ended_at: null });
    api.end.mockResolvedValue({ id: 'c1', ended_at: '2099-01-01' });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    await f.componentInstance.startConsultation('p1');
    expect(api.start).toHaveBeenCalledWith('g1');
    expect(f.componentInstance.patients()[0].status).toBe('in-consultation');
    await f.componentInstance.endConsultation('p1');
    expect(api.end).toHaveBeenCalledWith('c1');
    expect(f.componentInstance.patients()[0].status).toBe('completed');
  });
  it('reconstructs an active consultation after reload from the server history', async () => {
    api.listConsultations.mockResolvedValue({
      items: [{ id: 'c-existing', grant_id: 'g1', ended_at: null }],
      page: 1,
      page_size: 100,
      total: 1,
    });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    expect(f.componentInstance.patients()[0].consultationId).toBe('c-existing');
    expect(f.componentInstance.patients()[0].status).toBe('in-consultation');
  });
  it('paginates consultation history before deciding the refreshed queue status', async () => {
    const older = Array.from({ length: 100 }, (_, i) => ({
      id: `old-${i}`,
      grant_id: 'g1',
      ended_at: '2025-01-01T00:00:00Z',
    }));
    api.listConsultations.mockImplementation((_patientId: string, page = 1) =>
      Promise.resolve({
        items: page === 1 ? older : [{ id: 'ongoing', grant_id: 'g1', ended_at: null }],
        page,
        page_size: 100,
        total: 101,
      }),
    );
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    expect(api.listConsultations).toHaveBeenNthCalledWith(1, 'p1', 1);
    expect(api.listConsultations).toHaveBeenNthCalledWith(2, 'p1', 2);
    expect(f.componentInstance.patients()[0].status).toBe('in-consultation');
  });
  it('shows service failures and retries the API', async () => {
    api.list
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ items: [], page: 1, page_size: 100, total: 0 });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    expect(f.componentInstance.errorMessage()).toContain('unavailable');
    await f.componentInstance.loadQueue();
    expect(f.componentInstance.errorMessage()).toBe('');
    expect(f.componentInstance.patients()).toEqual([]);
  });
  it('blocks actions when history fails and recovers the actual active status on retry', async () => {
    api.listConsultations.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({
      items: [{ id: 'existing', grant_id: 'g1', ended_at: null }],
      page: 1,
      page_size: 100,
      total: 1,
    });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    f.detectChanges();
    expect(f.componentInstance.patients()[0].status).toBe('unknown');
    expect(f.nativeElement.textContent).toContain('Consultation status is unavailable');
    expect(f.nativeElement.textContent).not.toContain('Start consultation');
    await f.componentInstance.startConsultation('p1');
    expect(api.start).not.toHaveBeenCalled();
    await f.componentInstance.refreshPatientHistory('p1');
    expect(f.componentInstance.patients()[0].status).toBe('in-consultation');
    expect(f.componentInstance.patients()[0].consultationId).toBe('existing');
  });
  it('does not permit consultation without patient approval', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          patient: { patient_user_id: 'p2', display_name: 'No Consent', date_of_birth: null },
          grant_id: 'g2',
          categories: ['reports'],
          expires_at: '2099-01-01T00:00:00Z',
          allow_consultation: false,
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
    });
    const f = TestBed.createComponent(DoctorPatientQueue);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    await f.componentInstance.startConsultation('p2');
    expect(api.start).not.toHaveBeenCalled();
    expect(f.componentInstance.validationMessage()).toContain('separate consultation permission');
  });
});
