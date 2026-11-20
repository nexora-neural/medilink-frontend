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
import { DoctorDashboard } from './features/doctors/pages/doctor-dashboard/doctor-dashboard';
import { DoctorPlaceholder } from './features/doctors/pages/doctor-placeholder/doctor-placeholder';
import { AccountSupport } from './features/administration/account-support/account-support';
import { AdminAccounts } from './features/administration/admin-accounts/admin-accounts';
import { PatientMeasurements } from './features/measurements/pages/patient-measurements/patient-measurements';
import { DoctorQrPage } from './features/doctors/pages/doctor-qr-page/doctor-qr-page';
import { PatientDoctorAccess } from './features/patients/pages/patient-doctor-access/patient-doctor-access';
import { AdminDashboard } from './features/administration/admin-dashboard/admin-dashboard';
import { DoctorMedicineSearch } from './features/doctors/pages/doctor-medicine-search/doctor-medicine-search';
import { MedicineCatalogue } from './features/administration/medicine-catalogue/medicine-catalogue';
import { ClinicalRecords } from './features/medical-records/pages/clinical-records/clinical-records';
import { PatientLabRequests } from './features/lab-upload-requests/pages/patient-lab-requests/patient-lab-requests';
import { LabRequestResolution } from './features/lab-upload-requests/pages/lab-request-resolution/lab-request-resolution';

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
  {
    path: 'patient/lab-upload-requests',
    component: PatientLabRequests,
    canActivate: [roleGuard],
    title: 'Lab upload requests | MediLink',
    data: {
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'lab-staff/upload-requests',
    component: LabRequestResolution,
    canActivate: [roleGuard],
    title: 'Resolve lab upload request | MediLink',
    data: {
      allowedRoles: ['Lab Staff'],
    },
  },
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
  {
    path: 'patient/history',
    component: ClinicalRecords,
    canActivate: [roleGuard],
    title: 'Medical history | MediLink',
    data: {
      allowedRoles: ['Patient'],
      audience: 'patient',
    },
  },
  rolePage(
    'patient/reports',
    ['Patient'],
    'Reports',
    'A protected patient route for the reports workspace.',
  ),
  rolePage(
    'patient/vaccinations',
    ['Patient'],
    'Vaccinations',
    'A protected patient route for the vaccinations workspace.',
  ),
  {
    path: 'patient/access',
    component: PatientDoctorAccess,
    canActivate: [roleGuard],
    data: {
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'doctor/records',
    component: ClinicalRecords,
    canActivate: [roleGuard],
    title: 'Patient clinical records | MediLink',
    data: {
      allowedRoles: ['Doctor'],
      audience: 'doctor',
    },
  },
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

const doctorPreview = (path: string, title: string, description: string, qr = false): Route => ({
  path,
  component: DoctorPlaceholder,
  canActivate: [roleGuard],
  data: { allowedRoles: ['Doctor'], title, description, qr },
});

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
        path: 'doctor/dashboard',
        component: DoctorDashboard,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Doctor'],
        },
      },
      {
        path: 'doctor/medicines',
        component: DoctorMedicineSearch,
        canActivate: [roleGuard],
        title: 'Medicine catalogue | MediLink',
        data: {
          allowedRoles: ['Doctor'],
        },
      },
      doctorPreview(
        'doctor/patients',
        'Patient queue',
        'Patients who have shared access will appear here.',
      ),
      doctorPreview(
        'doctor/patients/:id',
        'Patient details',
        'Patient-specific records will be available after integration.',
      ),
      {
        path: 'doctor/qr',
        component: DoctorQrPage,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Doctor'],
        },
      },
      {
        path: 'doctor/verification',
        pathMatch: 'full',
        redirectTo: '/workspace/professional-verification',
      },
      doctorPreview(
        'doctor/notifications',
        'Notifications',
        'Your notifications will appear here.',
      ),
      doctorPreview(
        'doctor/prescription-review',
        'Patient-added prescription review',
        'Prescription review will be available after integration.',
      ),
      doctorPreview(
        'doctor/reports',
        'Laboratory reports',
        'Authorized laboratory reports will be available after integration.',
      ),

      {
        path: 'patient/profile',
        component: PatientProfile,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Patient'],
        },
      },
      {
        path: 'patient/measurements',
        component: PatientMeasurements,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Patient'],
        },
      },
      {
        path: 'professional-verification',
        component: ProfessionalVerification,
      },
      {
        path: 'professional-verification/membership-request',
        component: MembershipRequest,
        canActivate: [roleGuard],
        data: { allowedRoles: ['Doctor', 'Pharmacist', 'Lab Staff'] },
      },

      {
        path: 'admin/dashboard',
        component: AdminDashboard,
        canActivate: [roleGuard],
        title: 'Admin dashboard | MediLink',
        data: {
          allowedRoles: ['Admin'],
        },
      },

      {
        path: 'admin/account-support',
        component: AccountSupport,
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Admin', 'Super Admin'],
        },
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
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/administration/super-admin-dashboard/super-admin-dashboard').then(
            (m) => m.SuperAdminDashboard,
          ),
        title: 'Platform overview | MediLink',
      },
      {
        path: 'organizations/preview/:id',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'organization' },
      },
      {
        path: 'integrations',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'integrations' },
      },
      {
        path: 'integrations/preview/:id',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'integration-detail' },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'security' },
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'audit' },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: { previewPage: 'notifications' },
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
        path: 'applications',
        loadComponent: () =>
          import('./features/administration/professional-applications/professional-applications').then(
            (module) => module.ProfessionalApplications,
          ),
        title: 'Professional applications | MediLink',
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./features/administration/professional-applications/professional-application-detail').then(
            (module) => module.ProfessionalApplicationDetail,
          ),
        title: 'Application review | MediLink',
      },
      {
        path: 'account-support',
        component: AccountSupport,
      },
      {
        path: 'admin-accounts',
        component: AdminAccounts,
      },
      {
        path: 'medicine-catalogue',
        component: MedicineCatalogue,
        title: 'Medicine catalogue | MediLink',
      },
    ],
  },
  { path: '**', redirectTo: 'not-found' },
];
