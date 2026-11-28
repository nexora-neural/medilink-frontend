import { Route, Routes } from '@angular/router';
import { authenticatedRoleGuard, roleGuard } from './core/guards/role.guard';
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
import { DoctorPatientQueue } from './features/doctors/pages/doctor-patient-queue/doctor-patient-queue';
import { DoctorPlaceholder } from './features/doctors/pages/doctor-placeholder/doctor-placeholder';
import { AccountSupport } from './features/administration/account-support/account-support';
import { AdminAccounts } from './features/administration/admin-accounts/admin-accounts';
import { PatientMeasurements } from './features/measurements/pages/patient-measurements/patient-measurements';
import { AdminDashboard } from './features/administration/admin-dashboard/admin-dashboard';
import { DoctorMedicineSearch } from './features/doctors/pages/doctor-medicine-search/doctor-medicine-search';
import { MedicineCatalogue } from './features/administration/medicine-catalogue/medicine-catalogue';
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
    path: 'lab-staff/dashboard',
    loadComponent: () =>
      import('./features/lab-staff/pages/lab-dashboard/lab-dashboard').then(
        (module) => module.LabDashboard,
      ),
    canActivate: [roleGuard],
    title: 'Laboratory dashboard | MediLink',
    data: {
      allowedRoles: ['Lab Staff'],
    },
  },
  {
    path: 'patient/prescription-shares',
    loadChildren: () =>
      import('./features/prescription-sharing/prescription-sharing.routes').then(
        (m) => m.PRESCRIPTION_SHARING_ROUTES,
      ),
    canActivate: [roleGuard],
    title: 'Share a prescription | MediLink',
    data: { allowedRoles: ['Patient'], audience: 'patient' },
  },
  {
    path: 'pharmacist/prescription-shares',
    loadChildren: () =>
      import('./features/prescription-sharing/prescription-sharing.routes').then(
        (m) => m.PRESCRIPTION_SHARING_ROUTES,
      ),
    canActivate: [roleGuard],
    title: 'Claim a prescription | MediLink',
    data: { allowedRoles: ['Pharmacist'], audience: 'pharmacist' },
  },
  {
    path: 'doctor/prescriptions/:id/issue',
    loadChildren: () =>
      import('./features/doctors/pages/prescription-issue/prescription-issue.routes').then(
        (m) => m.PRESCRIPTION_ISSUE_ROUTES,
      ),
    canActivate: [roleGuard],
    title: 'Review & issue prescription | MediLink',
    data: { allowedRoles: ['Doctor'] },
  },
  {
    path: 'patient/lab-upload-requests',
    loadComponent: () =>
      import('./features/lab-upload-requests/pages/patient-lab-requests/patient-lab-requests-live').then(
        (module) => module.PatientLabRequestsLive,
      ),
    canActivate: [roleGuard],
    title: 'Lab upload requests | MediLink',
    data: {
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'lab-staff/upload-requests',
    loadComponent: () =>
      import('./features/lab-upload-requests/pages/lab-request-resolution/lab-request-resolution-live').then(
        (module) => module.LabRequestResolutionLive,
      ),
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
  {
    path: 'patient/prescriptions',
    loadComponent: () =>
      import('./features/patient-prescriptions/patient-prescriptions').then(
        (m) => m.PatientPrescriptions,
      ),
    canActivate: [roleGuard],
    title: 'My prescriptions | MediLink',
    data: { allowedRoles: ['Patient'] },
  },
  {
    path: 'patient/history',
    loadComponent: () =>
      import('./features/medical-records/pages/clinical-records/clinical-records').then(
        (module) => module.ClinicalRecords,
      ),
    canActivate: [roleGuard],
    title: 'Medical history | MediLink',
    data: {
      allowedRoles: ['Patient'],
      audience: 'patient',
    },
  },
  {
    path: 'patient/reports',
    loadComponent: () =>
      import('./features/reports/pages/reports-live').then((module) => module.ReportsLive),
    canActivate: [roleGuard],
    title: 'Patient reports | MediLink',
    data: {
      reportAudience: 'patient',
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'patient/vaccinations',
    loadComponent: () =>
      import('./features/vaccinations/pages/patient-vaccination-history/patient-vaccination-history').then(
        (m) => m.PatientVaccinationHistory,
      ),
    canActivate: [roleGuard],
    title: 'Vaccination history | MediLink',
    data: {
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'doctor/vaccinations',
    loadComponent: () =>
      import('./features/vaccinations/pages/doctor-vaccination-entry/doctor-vaccination-entry').then(
        (m) => m.DoctorVaccinationEntry,
      ),
    canActivate: [roleGuard],
    title: 'Vaccination entry | MediLink',
    data: {
      allowedRoles: ['Doctor'],
    },
  },
  {
    path: 'patient/access',
    loadComponent: () =>
      import('./features/patients/pages/patient-doctor-access/patient-doctor-access').then(
        (module) => module.PatientDoctorAccess,
      ),
    canActivate: [roleGuard],
    data: {
      allowedRoles: ['Patient'],
    },
  },
  {
    path: 'doctor/records',
    loadComponent: () =>
      import('./features/medical-records/pages/clinical-records/clinical-records').then(
        (module) => module.ClinicalRecords,
      ),
    canActivate: [roleGuard],
    title: 'Patient clinical records | MediLink',
    data: {
      allowedRoles: ['Doctor'],
      audience: 'doctor',
    },
  },
  {
    path: 'doctor/prescriptions',
    canActivate: [roleGuard],
    data: {
      allowedRoles: ['Doctor'],
    },
    loadChildren: () =>
      import('./features/prescriptions/prescription.routes').then(
        (module) => module.PRESCRIPTION_ROUTES,
      ),
  },
  {
    path: 'pharmacist/dispensing',
    loadComponent: () => import('./features/dispensing/dispensing').then((m) => m.Dispensing),
    canActivate: [roleGuard],
    title: 'Dispensing | MediLink',
    data: {
      allowedRoles: ['Pharmacist'],
    },
  },
  {
    path: 'lab-staff/reports',
    loadComponent: () =>
      import('./features/reports/pages/reports-live').then((module) => module.ReportsLive),
    canActivate: [roleGuard],
    title: 'Laboratory reports | MediLink',
    data: {
      reportAudience: 'lab',
      allowedRoles: ['Lab Staff'],
    },
  },
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
      {
        path: '',
        pathMatch: 'full',
        component: PublicHome,
      },
      {
        path: 'header-preview',
        component: PublicHome,
      },
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
      ].map((page) => ({
        path: page,
        component: PublicAuth,
        data: { page },
      })),
      ...['about', 'contact', 'privacy', 'terms'].map((page) => ({
        path: page,
        component: PublicInformational,
        data: { page },
      })),
    ],
  },

  {
    path: 'account-suspended',
    component: StatusPage,
    data: { code: 'suspended' },
  },
  {
    path: 'access-denied',
    component: StatusPage,
    data: { code: '403' },
  },
  {
    path: 'not-found',
    component: StatusPage,
    data: { code: '404' },
  },

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
      {
        path: 'doctor/patients',
        component: DoctorPatientQueue,
        canActivate: [roleGuard],
        title: 'Patient queue | MediLink',
        data: {
          allowedRoles: ['Doctor'],
        },
      },

      {
        path: 'doctor/patients/:id',
        loadComponent: () =>
          import('./features/medical-records/pages/clinical-records/clinical-records').then(
            (module) => module.ClinicalRecords,
          ),
        canActivate: [roleGuard],
        title: 'Patient clinical records | MediLink',
        data: { allowedRoles: ['Doctor'], audience: 'doctor', livePatientRecords: true },
      },

      {
        path: 'doctor/prescription-review',
        loadComponent: () =>
          import('./features/doctors/pages/doctor-evidence-review/doctor-evidence-review').then(
            (module) => module.DoctorEvidenceReview,
          ),
        canActivate: [roleGuard],
        title: 'Patient evidence review | MediLink',
        data: {
          allowedRoles: ['Doctor'],
        },
      },

      {
        path: 'doctor/qr',
        loadComponent: () =>
          import('./features/doctors/pages/doctor-qr-page/doctor-qr-page').then(
            (module) => module.DoctorQrPage,
          ),
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
        path: 'patient/notifications',
        loadComponent: () =>
          import('./features/patients/pages/patient-notifications/patient-notifications').then(
            (module) => module.PatientNotifications,
          ),
        canActivate: [roleGuard],
        title: 'Notifications | MediLink',
        data: {
          allowedRoles: ['Patient'],
        },
      },
      {
        path: 'patient/settings',
        loadComponent: () =>
          import('./features/patients/pages/patient-settings/patient-settings').then(
            (module) => module.PatientSettings,
          ),
        canActivate: [roleGuard],
        title: 'Settings | MediLink',
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
        data: {
          allowedRoles: ['Doctor', 'Pharmacist', 'Lab Staff'],
          allowPendingProfessionalApplicant: true,
        },
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
        path: 'admin/applications',
        loadComponent: () =>
          import('./features/administration/professional-applications/professional-applications').then(
            (module) => module.ProfessionalApplications,
          ),
        canActivate: [roleGuard],
        title: 'Professional applications | MediLink',
        data: {
          allowedRoles: ['Admin'],
        },
      },
      {
        path: 'admin/applications/:id',
        loadComponent: () =>
          import('./features/administration/professional-applications/professional-application-detail').then(
            (module) => module.ProfessionalApplicationDetail,
          ),
        canActivate: [roleGuard],
        title: 'Application review | MediLink',
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
      {
        path: 'patient/correction-request',
        loadComponent: () =>
          import('./features/clinical-corrections/clinical-corrections').then(
            (m) => m.ClinicalCorrections,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Patient'],
          mode: 'request',
        },
      },
      {
        path: 'patient/correction-history',
        loadComponent: () =>
          import('./features/clinical-corrections/clinical-corrections').then(
            (m) => m.ClinicalCorrections,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Patient'],
          mode: 'history',
        },
      },
      {
        path: 'doctor/correction-requests',
        loadComponent: () =>
          import('./features/clinical-corrections/clinical-corrections').then(
            (m) => m.ClinicalCorrections,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Doctor'],
          mode: 'decision',
        },
      },
      {
        path: 'doctor/corrections',
        loadComponent: () =>
          import('./features/clinical-corrections/clinical-corrections').then(
            (m) => m.ClinicalCorrections,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Doctor'],
          mode: 'correction',
        },
      },
      {
        path: 'doctor/correction-history',
        loadComponent: () =>
          import('./features/clinical-corrections/clinical-corrections').then(
            (m) => m.ClinicalCorrections,
          ),
        canActivate: [roleGuard],
        data: {
          allowedRoles: ['Doctor'],
          mode: 'history',
        },
      },
      {
        path: 'admin/audit',
        loadComponent: () =>
          import('./features/operations-activity/pages/operations-audit-page/operations-audit-page').then(
            (m) => m.OperationsAuditPage,
          ),
        canActivate: [roleGuard],
        title: 'Operations and audit | MediLink',
        data: {
          allowedRoles: ['Admin'],
          auditAudience: 'admin',
        },
      },
      {
        path: 'patient/access-history',
        loadComponent: () =>
          import('./features/operations-activity/pages/patient-activity-page/patient-activity-page').then(
            (m) => m.PatientActivityPage,
          ),
        canActivate: [roleGuard],
        title: 'Access history | MediLink',
        data: {
          allowedRoles: ['Patient'],
        },
      },

      ...rolePages,
    ],
  },

  {
    path: 'super-admin',
    component: SuperAdminShell,
    canActivate: [authenticatedRoleGuard],
    data: {
      allowedRoles: ['Super Admin'],
    },
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
        data: {
          previewPage: 'organization',
        },
      },
      {
        path: 'integrations/preview/:id',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: {
          previewPage: 'integration-detail',
        },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: {
          previewPage: 'security',
        },
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/operations-activity/pages/operations-audit-page/operations-audit-page').then(
            (m) => m.OperationsAuditPage,
          ),
        title: 'Privileged audit and recovery | MediLink',
        data: {
          auditAudience: 'super-admin',
        },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/administration/super-admin-preview/super-admin-preview').then(
            (m) => m.SuperAdminPreview,
          ),
        data: {
          previewPage: 'notifications',
        },
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
        path: 'integrations',
        loadComponent: () =>
          import('./features/administration/integration-clients/integration-clients').then(
            (module) => module.IntegrationClients,
          ),
        title: 'Integration clients | MediLink',
      },
      {
        path: 'integrations/submissions',
        loadComponent: () =>
          import('./features/administration/integration-clients/integration-clients').then(
            (module) => module.IntegrationClients,
          ),
        title: 'Submission outcomes | MediLink',
        data: {
          view: 'outcomes',
        },
      },
      {
        path: 'medicine-catalogue',
        component: MedicineCatalogue,
        title: 'Medicine catalogue | MediLink',
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'not-found',
  },
];
