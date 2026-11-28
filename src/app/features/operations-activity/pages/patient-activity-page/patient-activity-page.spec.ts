import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientActivityPage } from './patient-activity-page';
import { OperationsActivityApiService } from '../../operations-activity-api.service';
describe('PatientActivityPage integration', () => {
  const api = { activity: vi.fn() };
  let page: PatientActivityPage;
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: OperationsActivityApiService, useValue: api }],
    });
    page = TestBed.runInInjectionContext(() => new PatientActivityPage());
  });
  it('renders server activity without inventing doctor names and reloads on refresh', async () => {
    api.activity.mockResolvedValue({
      items: [
        {
          id: 'a',
          action: 'report.published',
          target_type: 'report',
          outcome: 'success',
          created_at: '2026-11-28T00:00:00Z',
        },
      ],
      page: 2,
      total: 21,
    });
    await page.load(2);
    expect(api.activity).toHaveBeenCalledWith(2);
    expect(page.activities()[0]).toMatchObject({
      actor: '',
      action: 'report.published',
      scope: 'report · success',
    });
    expect(page.page()).toBe(2);
    await page.load();
    expect(api.activity).toHaveBeenLastCalledWith(2);
  });
  it('clears stale data and shows denied access, with recovery after an empty successful response', async () => {
    page.activities.set([{ id: 'old', actor: '', action: 'old', scope: '', occurredAt: '' }]);
    api.activity.mockRejectedValue({ status: 403 });
    await page.load();
    expect(page.state()).toBe('error');
    expect(page.activities()).toEqual([]);
    expect(page.error()).toContain('permission');
    api.activity.mockResolvedValue({ items: [], page: 1, total: 0 });
    await page.load();
    expect(page.state()).toBe('empty');
    expect(page.error()).toBe('');
  });
  it('handles a service failure without showing sample data', async () => {
    api.activity.mockRejectedValue({ status: 503 });
    await page.load();
    expect(page.state()).toBe('error');
    expect(page.activities()).toEqual([]);
  });

  it('hides stale pagination during loading and failure, then restores it after recovery', async () => {
    api.activity.mockResolvedValue({ items: [], page: 1, page_size: 20, total: 44 });
    const fixture = TestBed.createComponent(PatientActivityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-activity-page-controls')?.textContent).toContain(
      '44 results',
    );

    let reject!: (reason: unknown) => void;
    api.activity.mockReturnValue(
      new Promise((_, rejectRequest) => {
        reject = rejectRequest;
      }),
    );
    const loading = fixture.componentInstance.load();
    fixture.detectChanges();
    expect(element.querySelector('app-activity-page-controls')).toBeNull();

    reject({ status: 503 });
    await loading;
    fixture.detectChanges();
    expect(element.querySelector('app-activity-page-controls')).toBeNull();
    expect(element.textContent).not.toContain('44 results');
    expect(element.textContent).toContain('Try again');

    api.activity.mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 });
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(element.querySelector('app-activity-page-controls')?.textContent).toContain('0 results');
  });
});
