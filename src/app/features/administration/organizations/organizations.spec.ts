import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizationsService } from './organizations.service';
import { Organizations } from './organizations';

describe('Organizations', () => {
  const organizationsApi = {
    listOrganizations: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    organizationsApi.listOrganizations.mockResolvedValue([
      {
        id: 'org-1',
        name: 'Central Clinic',
        type: 'clinic',
        registration_ref: 'REG-12',
        status: 'pending',
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-01T10:00:00Z',
      },
    ]);
    await TestBed.configureTestingModule({
      imports: [Organizations],
      providers: [provideRouter([]), { provide: OrganizationsService, useValue: organizationsApi }],
    }).compileComponents();
  });

  it('loads real organization records and labels their status', async () => {
    const fixture = TestBed.createComponent(Organizations);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(organizationsApi.listOrganizations).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Central Clinic');
    expect(element.textContent).toContain('Pending');
    expect(element.querySelector('a[href="/super-admin/organizations/org-1"]')).not.toBeNull();
  });

  it('shows a retry action when the organizations API fails', async () => {
    organizationsApi.listOrganizations.mockRejectedValue(new Error('Unavailable'));
    const fixture = TestBed.createComponent(Organizations);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Organizations could not be loaded. Please try again.',
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('button.retry')).not.toBeNull();
  });
});
