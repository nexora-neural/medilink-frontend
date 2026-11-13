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
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
