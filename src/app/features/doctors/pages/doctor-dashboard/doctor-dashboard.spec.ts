import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DoctorDashboard } from './doctor-dashboard';

describe('DoctorDashboard', () => {
  it('shows sample queue and allows a preview error to be retried', async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorDashboard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(DoctorDashboard);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nadeesha Perera');
    const patientLink = fixture.nativeElement.querySelector(
      'app-patient-queue a.patient-row',
    ) as HTMLAnchorElement;
    expect(patientLink.getAttribute('href')).toBe('/workspace/doctor/patients/P-1042');
    expect(
      (fixture.nativeElement.querySelector('a.qr-button') as HTMLAnchorElement).getAttribute(
        'href',
      ),
    ).toBe('/workspace/doctor/qr');
    fixture.componentInstance.setPreviewState('error');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dashboard unavailable');
    (
      fixture.nativeElement.querySelector('app-dashboard-status-panel button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nadeesha Perera');
  });
});
