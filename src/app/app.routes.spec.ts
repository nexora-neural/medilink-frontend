import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ActiveRoleService } from './core/context/active-role.service';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { RenderMode } from '@angular/ssr';
import { AuthService } from './core/auth.service';
import { OrganizationsService } from './features/administration/organizations/organizations.service';

describe('workspace routing', () => {
  it('renders admin application review routes on the client', () => {
    for (const path of ['workspace/admin/applications', 'workspace/admin/applications/:id']) {
      expect(serverRoutes.find((route) => route.path === path)?.renderMode).toBe(RenderMode.Client);
    }
  });

  it('renders professional verification on the client for direct navigation and refresh', () => {
    expect(
      serverRoutes.find((route) => route.path === 'workspace/professional-verification')
        ?.renderMode,
    ).toBe(RenderMode.Client);
  });

  it('renders the doctor QR page on the client for direct navigation and refresh', () => {
    expect(serverRoutes.find((route) => route.path === 'workspace/doctor/qr')?.renderMode).toBe(
      RenderMode.Client,
    );
  });

  it('renders patient and lab staff reports on the client for direct navigation and refresh', () => {
    const reportPaths = ['workspace/patient/reports', 'workspace/lab-staff/reports'];

    for (const path of reportPaths) {
      expect(serverRoutes.find((route) => route.path === path)?.renderMode).toBe(RenderMode.Client);
    }
  });

  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            restoreSession: vi.fn().mockResolvedValue(true),
            getOwnProfile: vi.fn(),
            getAuthorized: vi.fn().mockRejectedValue(new Error('API unavailable')),
            getAuthorizedBlob: vi.fn(),
            postAuthorized: vi.fn().mockRejectedValue(new Error('API unavailable')),
          },
        },
        {
          provide: OrganizationsService,
          useValue: {
            listPublicOrganizations: vi.fn().mockResolvedValue([]),
            requestMembership: vi.fn(),
          },
        },
      ],
    });
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-patient', ['patient']);
  });

  it.each([
    [
      'patient',
      'Medical history',
      '/workspace/patient/history',
      '/workspace/patient/correction-request',
    ],
    [
      'doctor',
      'Patient clinical records',
      '/workspace/doctor/records',
      '/workspace/doctor/correction-requests',
    ],
  ])(
    'opens corrections from the %s record workflow',
    async (role, heading, entryPath, targetPath) => {
      TestBed.inject(ActiveRoleService).setAccountRoles('navigation-test', [role]);
      const harness = await RouterTestingHarness.create(entryPath);
      expect(harness.routeNativeElement?.textContent).toContain(heading);
      const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
        'main a[href="' + targetPath + '"]',
      );
      expect(link).toBeTruthy();
      link!.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(targetPath);
    },
  );

  it('redirects an unauthenticated session to login', async () => {
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('does not open the workspace if session verification fails', async () => {
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockRejectedValue(
      new Error('unavailable'),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('opens an allowed role page and redirects a different role', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(harness.routeNativeElement?.textContent).toContain('Your care overview');
    expect(harness.routeNativeElement?.textContent).toContain('Sample preview only');

    await harness.navigateByUrl('/workspace/patient/medications');
    expect(harness.routeNativeElement?.textContent).toContain('Medications');
    expect(harness.routeNativeElement?.textContent).not.toContain('Your care overview');

    for (const [path, heading] of [
      ['/workspace/patient/prescriptions', 'Prescriptions'],
      ['/workspace/patient/history', 'Medical history'],
      ['/workspace/patient/reports', 'Reports'],
      ['/workspace/patient/measurements', 'Measurements'],
      ['/workspace/patient/vaccinations', 'Vaccinations'],
      ['/workspace/patient/access', 'Doctor access'],
    ]) {
      await harness.navigateByUrl(path);
      expect(harness.routeNativeElement?.textContent).toContain(heading);
      expect(harness.routeNativeElement?.textContent).not.toContain('Your care overview');
    }

    TestBed.inject(ActiveRoleService).setAccountRoles('demo-doctor', ['doctor']);
    await harness.navigateByUrl('/workspace/patient/reports');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Access denied');
  });

  it('allows professional accounts to request membership and blocks Super Admin', async () => {
    const harness = await RouterTestingHarness.create();
    const roles = TestBed.inject(ActiveRoleService);

    roles.setAccountRoles('demo-doctor', ['doctor']);
    await harness.navigateByUrl('/workspace/professional-verification/membership-request');
    expect(TestBed.inject(Router).url).toBe(
      '/workspace/professional-verification/membership-request',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Request organization membership');

    roles.setAccountRoles('demo-super-admin', ['super_admin']);
    await harness.navigateByUrl('/workspace');
    await harness.navigateByUrl('/workspace/professional-verification/membership-request');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
  });

  it('sends the unimplemented verification documents route to not found', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/verification-documents');
    expect(TestBed.inject(Router).url).toBe('/not-found');
  });

  it('restricts the super admin preview to the selected admin role', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/organizations');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    await harness.navigateByUrl('/super-admin/organizations');
    expect(harness.routeNativeElement?.textContent).toContain('Organizations and memberships');
  });

  it('allows admins to access the review queue and denies patients', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/admin/applications');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-admin', ['admin']);
    await harness.navigateByUrl('/workspace/admin/applications');
    expect(TestBed.inject(Router).url).toBe('/workspace/admin/applications');
    expect(harness.routeNativeElement?.textContent).toContain('Professional applications');
  });

  it('reviews an application and keeps the decision in its history when reopened', async () => {
    const applicationId = 'a87d99f1-652c-4c0e-85b7-50a863f1f2b1';
    let application = {
      id: applicationId,
      user_id: '1838c503-08f3-49a1-a512-212d24eb67b0',
      organization_id: 'b2f189a7-b5d7-4f6b-a0cf-ab88fb9c788e',
      role: 'doctor',
      registration_number: 'SLMC-12345',
      workplace: 'Lakeside Clinic',
      status: 'pending',
      submitted_at: '2026-11-21T08:00:00Z',
      reviewed_by: null as string | null,
      reviewed_at: null as string | null,
      review_reason: null as string | null,
      evidence_document_ids: ['604c84a0-152e-46ec-b77e-6ca8202924ab'],
      applicant_display_name: 'Dr. Maya Perera',
      organization_name: 'Lakeside Clinic',
    };
    let history: Array<Record<string, string>> = [];
    const auth = TestBed.inject(AuthService);
    vi.mocked(auth.getAuthorized).mockImplementation(async (path: string) => {
      if (path === 'admin/verification-applications?page=1&page_size=100') {
        return { items: [application], page: 1, page_size: 100, total: 1 };
      }
      if (path === `admin/verification-applications/${applicationId}`) return application;
      if (path.includes('/decisions?')) {
        return { items: history, page: 1, page_size: 100, total: history.length };
      }
      if (path.startsWith('documents/')) {
        return {
          id: application.evidence_document_ids[0],
          document_type: 'verification_evidence',
          original_filename: 'sample-slmc.pdf',
          created_at: application.submitted_at,
        };
      }
      if (path.startsWith('admin/organizations/')) {
        return { id: application.organization_id, name: application.organization_name };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });
    vi.mocked(auth.postAuthorized).mockImplementation(async (_path: string, body: unknown) => {
      const input = body as { status: string; reason: string };
      const reviewerId = '1838c503-08f3-49a1-a512-212d24eb67b0';
      application = {
        ...application,
        status: input.status,
        reviewed_by: reviewerId,
        reviewed_at: '2026-11-21T09:00:00Z',
        review_reason: input.reason,
      };
      history = [
        {
          id: '7aa55a27-2446-4bdb-929e-6ccaf0c164f2',
          application_id: applicationId,
          reviewer_user_id: reviewerId,
          reviewer_display_name: 'Demo reviewer',
          decision: input.status,
          reason: input.reason,
          decided_at: application.reviewed_at!,
        },
      ];
      return application;
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/applications');
    expect(TestBed.inject(Router).url).toBe('/access-denied');

    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    await harness.navigateByUrl('/super-admin/applications');
    expect(harness.routeNativeElement?.textContent).toContain('Loading applications');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Dr. Maya Perera');
    });

    await harness.navigateByUrl(`/super-admin/applications/${applicationId}`);
    const detail = harness.routeNativeElement!;
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(detail.textContent).toContain('Manual SLMC comparison');
    });

    const form = detail.querySelector('form')!;
    const decision = form.querySelector('select')!;
    const reason = form.querySelector('textarea')!;
    const submit = () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      harness.detectChanges();
    };

    decision.value = 'Approved';
    decision.dispatchEvent(new Event('change'));
    reason.value = '   ';
    reason.dispatchEvent(new Event('input'));
    submit();
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(detail.textContent).toContain('No decisions recorded yet.');

    reason.value = '  Compared the submitted SLMC number.\nReviewed identity evidence.  ';
    reason.dispatchEvent(new Event('input'));
    submit();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(detail.textContent).toContain('Decision recorded.');
    });

    await harness.navigateByUrl('/super-admin/applications');
    await vi.waitFor(() => {
      harness.detectChanges();
      const row = harness.routeNativeElement?.querySelector(`a[href$="${applicationId}"]`);
      expect(row?.textContent).toContain('Approved');
    });

    await harness.navigateByUrl(`/super-admin/applications/${applicationId}`);
    await vi.waitFor(() => {
      harness.detectChanges();
      const history = harness.routeNativeElement?.querySelector('.history');
      expect(history?.textContent).toContain('Demo reviewer');
      expect(history?.textContent).toContain('Compared the submitted SLMC number.');
      expect(history?.querySelector('time')?.getAttribute('datetime')).toBeTruthy();
    });
  });

  it('shows the detail error and a return link for an unknown application', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/applications/missing');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Unable to open this application');
    });
    expect(harness.routeNativeElement?.querySelector('a.back')?.getAttribute('href')).toBe(
      '/super-admin/applications',
    );
  });

  it('restores a Patient session before opening the profile directly', async () => {
    const roleContext = TestBed.inject(ActiveRoleService);
    const auth = TestBed.inject(AuthService);

    // Start with no roles, as on a fresh browser load.
    roleContext.clear();

    vi.mocked(auth.restoreSession).mockImplementation(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      roleContext.setAccountRoles('demo-patient', ['patient']);
      return true;
    });

    vi.mocked(auth.getOwnProfile).mockResolvedValue({
      user: {
        id: 'demo-patient',
        email: 'patient@example.com',
        display_name: 'Demo Patient',
        phone: null,
        status: 'active',
      },
      roles: ['patient'],
      memberships: [],
      patient_profile: null,
      professional_profile: null,
    });

    const harness = await RouterTestingHarness.create();

    // Navigate directly without visiting /workspace first.
    await harness.navigateByUrl('/workspace/patient/profile');

    expect(TestBed.inject(Router).url).toBe('/workspace/patient/profile');
    expect(auth.restoreSession).toHaveBeenCalled();

    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Demo Patient');
    });

    expect(harness.routeNativeElement?.textContent).not.toContain('Access denied');
  });

  it('restores an Admin session before opening the dashboard directly', async () => {
    const roleContext = TestBed.inject(ActiveRoleService);
    const auth = TestBed.inject(AuthService);

    roleContext.setAccountRoles('demo-admin', ['admin']);

    vi.mocked(auth.restoreSession).mockImplementation(async () => {
      await Promise.resolve();
      roleContext.setAccountRoles('demo-admin', ['admin']);
      return true;
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/admin/dashboard');

    expect(auth.restoreSession).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(harness.routeNativeElement?.textContent).toContain('Account support'),
    );
    expect(TestBed.inject(Router).url).toBe('/workspace/admin/dashboard');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Admin dashboard',
    );

    const supportLink = harness.routeNativeElement?.querySelector(
      '.admin-dashboard a[href="/workspace/admin/account-support"]',
    ) as HTMLAnchorElement | null;

    expect(supportLink).toBeNull();
    await vi.waitFor(() =>
      expect(harness.routeNativeElement?.textContent).toContain('Dashboard unavailable'),
    );
  });

  it.each(['patient', 'doctor', 'pharmacist', 'lab_staff', 'super_admin'])(
    'denies the Admin dashboard to an account with only the %s role',
    async (role) => {
      TestBed.inject(ActiveRoleService).setAccountRoles('demo-other-account', [role]);

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/workspace/admin/dashboard');

      expect(TestBed.inject(Router).url).toBe('/access-denied');
      expect(harness.routeNativeElement?.textContent).toContain('Access denied');
    },
  );

  it('redirects a signed-out dashboard visitor to login', async () => {
    TestBed.inject(ActiveRoleService).clear();
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/admin/dashboard');

    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('allows a pending professional applicant to request membership without granting a role', async () => {
    vi.mocked(TestBed.inject(AuthService).getOwnProfile).mockResolvedValue({
      user: {
        id: 'pending-applicant',
        email: null,
        display_name: 'Pending',
        phone: null,
        status: 'active',
      },
      roles: [],
      memberships: [],
      patient_profile: null,
      professional_profile: {
        user_id: 'pending-applicant',
        role: 'doctor',
        doctor_reference: null,
        registration_number: null,
        workplace: null,
        qualifications: null,
        specialty: null,
        verification_status: 'not_submitted',
        created_at: '',
        updated_at: '',
      },
    });
    const roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('pending-applicant', []);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/professional-verification/membership-request');

    expect(TestBed.inject(Router).url).toBe(
      '/workspace/professional-verification/membership-request',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Request organization membership');
    expect(roles.roles()).toEqual([]);
  });

  it.each(['pending', 'rejected', 'more_info_requested'] as const)(
    'allows a roleless professional with %s verification to reach membership request',
    async (verificationStatus) => {
      vi.mocked(TestBed.inject(AuthService).getOwnProfile).mockResolvedValue({
        user: {
          id: 'roleless-professional',
          email: null,
          display_name: 'Roleless professional',
          phone: null,
          status: 'active',
        },
        roles: [],
        memberships: [],
        patient_profile: null,
        professional_profile: {
          user_id: 'roleless-professional',
          role: 'doctor',
          doctor_reference: null,
          registration_number: null,
          workplace: null,
          qualifications: null,
          specialty: null,
          verification_status: verificationStatus,
          created_at: '',
          updated_at: '',
        },
      });
      TestBed.inject(ActiveRoleService).setAccountRoles('roleless-professional', []);

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/workspace/professional-verification/membership-request');

      expect(TestBed.inject(Router).url).toBe(
        '/workspace/professional-verification/membership-request',
      );
      expect(TestBed.inject(ActiveRoleService).roles()).toEqual([]);
    },
  );

  it('denies a roleless professional after approval until a role is assigned', async () => {
    vi.mocked(TestBed.inject(AuthService).getOwnProfile).mockResolvedValue({
      user: {
        id: 'approved-roleless-professional',
        email: null,
        display_name: 'Approved professional',
        phone: null,
        status: 'active',
      },
      roles: [],
      memberships: [],
      patient_profile: null,
      professional_profile: {
        user_id: 'approved-roleless-professional',
        role: 'doctor',
        doctor_reference: null,
        registration_number: 'D123',
        workplace: null,
        qualifications: null,
        specialty: null,
        verification_status: 'approved',
        created_at: '',
        updated_at: '',
      },
    });
    TestBed.inject(ActiveRoleService).setAccountRoles('approved-roleless-professional', []);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/professional-verification/membership-request');

    expect(TestBed.inject(Router).url).toBe('/access-denied');
  });

  it('denies membership requests for non-professional profiles', async () => {
    vi.mocked(TestBed.inject(AuthService).getOwnProfile).mockResolvedValue({
      user: {
        id: 'patient-account',
        email: null,
        display_name: 'Patient',
        phone: null,
        status: 'active',
      },
      roles: ['patient'],
      memberships: [],
      patient_profile: null,
      professional_profile: null,
    });
    TestBed.inject(ActiveRoleService).setAccountRoles('patient-account', ['patient']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/professional-verification/membership-request');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
  });
  it('restores a Doctor session before opening the patient queue directly', async () => {
    const roleContext = TestBed.inject(ActiveRoleService);
    const auth = TestBed.inject(AuthService);

    roleContext.clear();

    vi.mocked(auth.restoreSession).mockImplementation(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      roleContext.setAccountRoles('demo-doctor', ['doctor']);
      return true;
    });

    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/workspace/doctor/patients');

    expect(auth.restoreSession).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/workspace/doctor/patients');
    expect(harness.routeNativeElement?.textContent).toContain('Nadeesha Perera');
    expect(harness.routeNativeElement?.textContent).not.toContain('Access denied');
  });

  it('restores a Doctor session before opening the QR page directly', async () => {
    const roleContext = TestBed.inject(ActiveRoleService);
    const auth = TestBed.inject(AuthService);

    roleContext.clear();
    vi.mocked(auth.restoreSession).mockImplementation(async () => {
      roleContext.setAccountRoles('demo-doctor', ['doctor']);
      return true;
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/doctor/qr');

    expect(auth.restoreSession).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/workspace/doctor/qr');
    expect(harness.routeNativeElement?.textContent).toContain('My QR code');
  });

  it('denies the Doctor QR page to a signed-in non-doctor', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-patient', ['patient']);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/doctor/qr');

    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Access denied');
  });

  it('redirects a signed-out QR page visitor to login', async () => {
    TestBed.inject(ActiveRoleService).clear();
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace/doctor/qr');

    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
