import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DoctorIdentityService } from '../../../doctor-identity/doctor-identity.service';
import { DoctorQrPage } from './doctor-qr-page';

describe('DoctorQrPage', () => {
  let fixture: ComponentFixture<DoctorQrPage>;
  let api: { getMyQr: ReturnType<typeof vi.fn> };

  const response = {
    doctor_reference: 'opaque-doctor-reference',
    qr_payload: 'opaque-doctor-reference',
    verification_status: 'approved',
  };

  beforeEach(async () => {
    api = { getMyQr: vi.fn().mockResolvedValue(response) };
    await TestBed.configureTestingModule({
      imports: [DoctorQrPage],
      providers: [provideRouter([]), { provide: DoctorIdentityService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(DoctorQrPage);
    fixture.detectChanges();
  });

  it('loads an opaque reference from the API and displays a generated QR', async () => {
    await vi.waitFor(() => expect(fixture.componentInstance.state()).toBe('ready'));
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('.qr-frame img') as HTMLImageElement;
    expect(api.getMyQr).toHaveBeenCalledOnce();
    expect(image.src.startsWith('data:image/svg+xml,')).toBe(true);
    expect(image.alt.toLowerCase()).toContain('scannable');
    expect(fixture.nativeElement.textContent).toContain('opaque-doctor-reference');
    expect(fixture.nativeElement.textContent).toContain('Approved');
    expect(decodeURIComponent(image.src)).not.toContain('Test Doctor');
  });

  it('shows a verified-doctor denial without rendering a QR', async () => {
    api.getMyQr.mockRejectedValue({ status: 403 });
    await fixture.componentInstance.loadQr();
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('denied');
    expect(fixture.nativeElement.textContent).toContain('only for a verified doctor');
    expect(fixture.nativeElement.querySelector('.qr-frame')).toBeNull();
  });

  it('offers retry for service failures', async () => {
    api.getMyQr.mockRejectedValue({ status: 503 });
    await fixture.componentInstance.loadQr();
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('service is unavailable');
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Try again');
  });

  it('rejects a payload that is not the opaque doctor reference', async () => {
    api.getMyQr.mockResolvedValue({ ...response, qr_payload: 'Dr Test, Test Clinic' });
    await fixture.componentInstance.loadQr();
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.qrImage()).toBe('');
  });
});
