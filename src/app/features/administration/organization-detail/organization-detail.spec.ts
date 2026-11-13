import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OrganizationDetail } from './organization-detail';
import { OrganizationsService } from '../organizations/organizations.service';

describe('OrganizationDetail', () => {
  const organization = {
    id: 'org-1',
    name: 'Central Clinic',
    type: 'clinic',
    registration_ref: 'REG-12',
    status: 'pending' as const,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  };
  const membership = {
    id: 'membership-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    role: 'doctor',
    status: 'pending' as const,
    verified_at: null,
    created_at: '2026-11-01T10:00:00Z',
  };
  const organizationsApi = {
    getOrganization: vi.fn(),
    listMemberships: vi.fn(),
    decideOrganization: vi.fn(),
    decideMembership: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    organizationsApi.getOrganization.mockResolvedValue(organization);
    organizationsApi.listMemberships.mockResolvedValue([membership]);
    await TestBed.configureTestingModule({
      imports: [OrganizationDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'org-1' }) } },
        },
        { provide: OrganizationsService, useValue: organizationsApi },
      ],
    }).compileComponents();
  });

  it('loads organization and membership records from the API', async () => {
    const fixture = TestBed.createComponent(OrganizationDetail);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Central Clinic');
    });

    const element = fixture.nativeElement as HTMLElement;
    expect(organizationsApi.getOrganization).toHaveBeenCalledWith('org-1');
    expect(organizationsApi.listMemberships).toHaveBeenCalledWith('org-1');
    expect(element.textContent).toContain('user-1');
    expect(element.querySelector('.confirmation')).toBeNull();
  });

  it('requires a reason and persists a Super Admin decision', async () => {
    organizationsApi.decideOrganization.mockResolvedValue({ ...organization, status: 'active' });
    const fixture = TestBed.createComponent(OrganizationDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.prepareOrganizationDecision('active');
    await fixture.componentInstance.confirmDecision();
    expect(organizationsApi.decideOrganization).not.toHaveBeenCalled();

    fixture.componentInstance.reason.setValue('Registration details verified.');
    await fixture.componentInstance.confirmDecision();
    fixture.detectChanges();

    expect(organizationsApi.decideOrganization).toHaveBeenCalledWith(
      'org-1',
      'active',
      'Registration details verified.',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Organization decision saved: Approved.',
    );
  });

  it('preserves the decision when the server rejects it and explains the conflict', async () => {
    organizationsApi.decideOrganization.mockRejectedValue({ status: 409 });
    const fixture = TestBed.createComponent(OrganizationDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.prepareOrganizationDecision('active');
    fixture.componentInstance.reason.setValue('Verified');

    await fixture.componentInstance.confirmDecision();
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingDecision()).toEqual({
      target: 'organization',
      status: 'active',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This decision is not valid for the current status.',
    );
  });
});
