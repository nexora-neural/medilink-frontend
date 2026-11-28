import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const PRESCRIPTION_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: {
      allowedRoles: ['Doctor'],
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/prescription-list/prescription-list').then(
            (module) => module.PrescriptionList,
          ),
        title: 'Prescriptions | MediLink',
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./pages/prescription-editor/prescription-editor').then(
            (module) => module.PrescriptionEditor,
          ),
        title: 'Edit prescription draft | MediLink',
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/prescription-detail/prescription-detail').then(
            (module) => module.PrescriptionDetail,
          ),
        title: 'Prescription details | MediLink',
      },
    ],
  },
];
