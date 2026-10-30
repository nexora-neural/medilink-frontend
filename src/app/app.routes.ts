import { Route, Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';
import { AppShell } from './layout/app-shell';
import { StatusPage } from './pages/status-page';
import { WorkspacePage } from './pages/workspace-page';

const rolePage = (
  path: string,
  allowedRoles: string[],
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
  { path: '', pathMatch: 'full', redirectTo: 'workspace' },
  { path: 'access-denied', component: StatusPage, data: { code: '403' } },
  { path: 'not-found', component: StatusPage, data: { code: '404' } },
  {
    path: 'workspace',
    component: AppShell,
    children: [
      {
        path: '',
        component: WorkspacePage,
        data: {
          title: 'Workspace overview',
          description: 'A responsive MediLink workspace foundation for role-aware navigation.',
        },
      },
      ...rolePages,
    ],
  },
  { path: '**', redirectTo: 'not-found' },
];
