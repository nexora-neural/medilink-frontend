import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'workspace/patient/prescription-shares', renderMode: RenderMode.Client },
  { path: 'workspace/pharmacist/prescription-shares', renderMode: RenderMode.Client },
  { path: 'workspace/pharmacist/dispensing', renderMode: RenderMode.Client },
  { path: 'workspace/patient/prescriptions', renderMode: RenderMode.Client },
  { path: 'workspace/doctor/prescriptions/:id/issue', renderMode: RenderMode.Client },
  { path: 'super-admin/dashboard', renderMode: RenderMode.Client },
  { path: 'super-admin/organizations/preview/:id', renderMode: RenderMode.Client },
  { path: 'super-admin/integrations', renderMode: RenderMode.Client },
  { path: 'super-admin/integrations/preview/:id', renderMode: RenderMode.Client },
  { path: 'super-admin/security', renderMode: RenderMode.Client },
  { path: 'super-admin/audit', renderMode: RenderMode.Client },
  { path: 'super-admin/notifications', renderMode: RenderMode.Client },

  { path: 'super-admin/integrations/submissions', renderMode: RenderMode.Client },

  {
    path: 'super-admin/organizations',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/admin/dashboard',
    renderMode: RenderMode.Client,
  },
  { path: 'workspace/admin/applications', renderMode: RenderMode.Client },
  { path: 'workspace/admin/applications/:id', renderMode: RenderMode.Client },
  {
    path: 'workspace/patient/profile',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/patients',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/patients/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'super-admin/organizations/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'super-admin/applications/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/medicines',
    renderMode: RenderMode.Client,
  },
  {
    path: 'super-admin/medicine-catalogue',
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
    path: 'workspace/patient/vaccinations',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/vaccinations',
    renderMode: RenderMode.Client,
  },
  { path: 'workspace/patient/correction-request', renderMode: RenderMode.Client },
  { path: 'workspace/patient/correction-history', renderMode: RenderMode.Client },
  { path: 'workspace/doctor/correction-requests', renderMode: RenderMode.Client },
  { path: 'workspace/doctor/corrections', renderMode: RenderMode.Client },
  { path: 'workspace/doctor/correction-history', renderMode: RenderMode.Client },
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
    path: 'workspace/doctor/prescriptions',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/prescriptions/:id/edit',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/doctor/prescriptions/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/reports',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/patient/reports/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/lab-staff/reports',
    renderMode: RenderMode.Client,
  },
  {
    path: 'workspace/lab-staff/reports/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
