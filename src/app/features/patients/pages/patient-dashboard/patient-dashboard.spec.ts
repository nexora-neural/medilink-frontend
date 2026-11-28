import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth.service';
import { PatientDashboard } from './patient-dashboard';

describe('PatientDashboard', () => {
  const request = vi.fn();
  const profile = {
    user: { id: 'self', display_name: 'Patient A' },
    patient_profile: { user_id: 'self' },
  };

  beforeEach(() => {
    request.mockReset();
    TestBed.configureTestingModule({
      imports: [PatientDashboard],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getAuthorized: request } },
      ],
    });
  });

  it('loads only the signed-in patient and maps live schedule and notifications', async () => {
    request.mockImplementation(async (path: string) => {
      if (path === 'me') return profile;
      if (path.startsWith('me/notifications?'))
        return {
          items: [
            {
              id: 'notice',
              title: 'New update',
              body: 'Review your schedule',
              created_at: new Date().toISOString(),
            },
          ],
        };
      if (path.startsWith('patients/self/dose-occurrences?')) {
        const now = new Date();
        now.setHours(21, 0, 0, 0);
        return {
          items: [
            {
              id: 'dose',
              schedule_id: 'schedule',
              status: 'taken',
              scheduled_for: now.toISOString(),
            },
          ],
          total: 1,
          page_size: 100,
        };
      }
      if (path.startsWith('patients/self/medication-schedules?'))
        return {
          items: [
            {
              schedule: { id: 'schedule', prescription_item_id: 'item' },
              prescription_source: 'doctor',
            },
          ],
          total: 1,
          page_size: 100,
        };
      if (path.startsWith('patients/self/prescriptions?'))
        return {
          items: [
            { items: [{ id: 'item', medicine_name_snapshot: 'Medicine A', dose_text: '5 mg' }] },
          ],
          total: 1,
          page_size: 100,
        };
      throw new Error(path);
    });
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading your dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Welcome, Patient A');
    expect(fixture.nativeElement.textContent).toContain('Medicine A');
    expect(fixture.nativeElement.textContent).toContain('New update');
    expect(fixture.componentInstance.responsePercent).toBe(100);
    expect(fixture.nativeElement.querySelector('.timeline-event').style.left).toBe('87.5%');
  });

  it('recovers after failure and renders empty API results', async () => {
    request.mockRejectedValueOnce({ status: 503 });
    const fixture = TestBed.createComponent(PatientDashboard);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dashboard information is unavailable');
    request
      .mockResolvedValueOnce(profile)
      .mockResolvedValue({ items: [], total: 0, page_size: 100 });
    await fixture.componentInstance.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No medicines are scheduled for today.');
    expect(fixture.nativeElement.textContent).toContain(
      'You do not have any recent notifications.',
    );
  });

  it.each([
    [401, 'Your session has expired'],
    [403, 'Dashboard access is unavailable'],
  ])('handles HTTP %s without exposing patient content', async (status, message) => {
    request.mockRejectedValue({ status });
    const fixture = TestBed.createComponent(PatientDashboard);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(fixture.componentInstance.data()).toBeNull();
  });

  it('does not request patient resources for a mismatched profile', async () => {
    request.mockResolvedValue({ ...profile, patient_profile: { user_id: 'other' } });
    const fixture = TestBed.createComponent(PatientDashboard);
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('denied');
    expect(request).toHaveBeenCalledExactlyOnceWith('me');
  });
});
