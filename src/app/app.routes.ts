import { Route, Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { authGuard } from './core/auth.guard';
import { ActiveRole } from './core/context/active-role.service';
import { AppShell } from './layout/workspace-shell/app-shell';
import { StatusPage } from './pages/errors/status-page/status-page';
import { WorkspacePage } from './features/workspace/pages/workspace-page/workspace-page';
import { PublicAuth } from './features/public/auth/auth';
import { PublicShell } from './features/public/public-shell';
import { PublicHome } from './features/public/home/home';
import { PublicInformational } from './features/public/informational/informational';
import { SuperAdminShell } from './features/administration/super-admin-shell/super-admin-shell';
import { Organizations } from './features/administration/organizations/organizations';
import { OrganizationDetail } from './features/administration/organization-detail/organization-detail';
import { MembershipRequest } from './features/administration/membership-request/membership-request';
import { PatientProfile } from './features/patients/pages/patient-profile/patient-profile';
import { ProfessionalVerification } from './features/professional-verification/professional-verification';

const rolePage = (
  path: string,
  allowedRoles: ActiveRole[],
  title: string,
  description: string,
): Route => ({
  path,
  component: WorkspacePage,
  canActivate: [roleGuard],
  data: { allowedRoles, title, description },
});

const rolePages: Route[] = [
  rolePage(
    'patient/medications',
    ['Patient'],
    'Medications',
    'A protected patient route for the medication workspace.',
  ),
  rolePage(
    'patient/prescriptions',
    ['Patient'],
    'Prescriptions',
    'A protected patient route for the prescription workspace.',
  ),
  rolePage(
    'patient/history',
    ['Patient'],
    'Medical history',
    'A protected patient route for the medical history workspace.',
  ),
  rolePage(
    'patient/reports',
    ['Patient'],
    'Reports',
    'A protected patient route for the reports workspace.',
  ),
  rolePage(
    'patient/measurements',
    ['Patient'],
    'Measurements',
    'A protected patient route for the measurements workspace.',
  ),
  rolePage(
    'patient/vaccinations',
    ['Patient'],
    'Vaccinations',
    'A protected patient route for the vaccinations workspace.',
  ),
  rolePage(
    'patient/access',
    ['Patient'],
    'Doctor access',
    'A protected patient route for the doctor access workspace.',
  ),
  rolePage(
    'doctor/records',
    ['Doctor'],
    'Patient records',
    'A protected doctor route for the patient records workspace.',
  ),
  rolePage(
    'doctor/prescriptions',
    ['Doctor'],
    'Prescriptions',
    'A protected doctor route for the prescription workspace.',
  ),
  rolePage(
    'pharmacist/dispensing',
    ['Pharmacist'],
    'Dispensing',
    'A protected pharmacist route for the dispensing workspace.',
  ),
  rolePage(
    'lab-staff/reports',
    ['Lab Staff'],
    'Laboratory reports',
    'A protected lab staff route for the report workspace.',
  ),
];

export const routes: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', pathMatch: 'full', component: PublicHome },
      { path: 'header-preview', component: PublicHome },
      ...[
        'login',
        'roles',
        'professional-registration',
        'register',
        'verify',
        'forgot',
        'reset',
        'help',
        'session-expired',
      ].map((page) => ({ path: page, component: PublicAuth, data: { page } })),
      ...['about', 'contact', 'privacy', 'terms'].map((page) => ({
        path: page,
        component: PublicInformational,
        data: { page },
      })),
    ],
  },
  { path: 'account-suspended', component: StatusPage, data: { code: 'suspended' } },
  { path: 'access-denied', component: StatusPage, data: { code: '403' } },
  { path: 'not-found', component: StatusPage, data: { code: '404' } },
  {
    path: 'workspace',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: WorkspacePage,
        data: {
          title: 'Workspace overview',
          description: 'A responsive MediLink workspace foundation for role-aware navigation.',
        },
      },
      {
        path: 'patient/profile',
        component: PatientProfile,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Patient'],
        },
      },
      {
        path: 'professional-verification',
        component: ProfessionalVerification,
      },
      ...rolePages,
    ],
  },

  {
    path: 'super-admin',
    component: SuperAdminShell,
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['Super Admin'] },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'organizations',
      },
      {
        path: 'organizations',
        component: Organizations,
      },
      {
        path: 'organizations/:id',
        component: OrganizationDetail,
      },
      {
        path: 'membership-request',
        component: MembershipRequest,
      },
    ],
  },

  { path: '**', redirectTo: 'not-found' },
];
