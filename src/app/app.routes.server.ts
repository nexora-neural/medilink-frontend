import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'super-admin/organizations',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/admin/dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/profile',
    renderMode: RenderMode.Client,
  },
  { path: 'workspace/doctor/patients/:id', renderMode: RenderMode.Server },
  {
    path: 'super-admin/organizations/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'super-admin/applications/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'workspace/doctor/medicines',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/admin/medicine-catalogue',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/admin/account-support',
    renderMode: RenderMode.Client,
  },
  {
    path: 'super-admin/account-support',
    renderMode: RenderMode.Client,
  },
  {
    path: 'super-admin/admin-accounts',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/access',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/professional-verification',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/professional-verification/membership-request',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/measurements',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/history',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/records',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/lab-upload-requests',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/lab-staff/upload-requests',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
