import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizationsService } from '../organizations/organizations.service';
import { MembershipRequest } from './membership-request';

describe('MembershipRequest', () => {
  const organizationsApi = {
    listPublicOrganizations: vi.fn(),
    requestMembership: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    organizationsApi.listPublicOrganizations.mockResolvedValue([
      { id: 'org-uuid-1', name: 'Central Clinic', type: 'clinic' },
    ]);
    await TestBed.configureTestingModule({
      imports: [MembershipRequest],
      providers: [provideRouter([]), { provide: OrganizationsService, useValue: organizationsApi }],
    }).compileComponents();
  });

  it('loads active organizations from the API instead of using sample IDs', async () => {
    const fixture = TestBed.createComponent(MembershipRequest);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(organizationsApi.listPublicOrganizations).toHaveBeenCalledOnce();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Central Clinic');
    expect(fixture.componentInstance.organizations()).toEqual([
      { id: 'org-uuid-1', name: 'Central Clinic', type: 'clinic' },
    ]);
  });

  it('submits the authenticated request and reports the persisted pending result', async () => {
    organizationsApi.requestMembership.mockResolvedValue({
      id: 'membership-1',
      organization_id: 'org-uuid-1',
      role: 'doctor',
      status: 'pending',
    });
    const fixture = TestBed.createComponent(MembershipRequest);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.organizationId = 'org-uuid-1';
    fixture.componentInstance.professionalRole = 'doctor';

    await fixture.componentInstance.submit();

    expect(organizationsApi.requestMembership).toHaveBeenCalledWith('org-uuid-1', 'doctor');
    expect(fixture.componentInstance.success()).toContain('submitted and is pending review');
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('explains duplicate and ineligible requests using API status codes', async () => {
    const fixture = TestBed.createComponent(MembershipRequest);
    fixture.componentInstance.organizations.set([
      { id: 'org-uuid-1', name: 'Central Clinic', type: 'clinic' },
    ]);
    fixture.componentInstance.organizationId = 'org-uuid-1';
    fixture.componentInstance.professionalRole = 'doctor';
    organizationsApi.requestMembership.mockRejectedValueOnce({ status: 409 });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('already exists');

    organizationsApi.requestMembership.mockRejectedValueOnce({ status: 403 });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('not eligible');
  });
});
