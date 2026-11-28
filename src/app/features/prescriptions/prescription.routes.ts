import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { PrescriptionDraftPreviewStore } from './services/prescription-draft-preview.store';
import { PRESCRIPTION_PDF_EXPORT } from './pdf-export/prescription-pdf-export.models';
import { PrescriptionPdfExportPreviewStore } from './pdf-export/prescription-pdf-preview.store';

export const PRESCRIPTION_ROUTES: Routes = [
  {
    path: '',
    providers: [PrescriptionDraftPreviewStore],
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
        path: ':id/export',
        providers: [
          PrescriptionPdfExportPreviewStore,
          { provide: PRESCRIPTION_PDF_EXPORT, useExisting: PrescriptionPdfExportPreviewStore },
        ],
        loadComponent: () =>
          import('./pdf-export/prescription-pdf-export').then(
            (module) => module.PrescriptionPdfExport,
          ),
        title: 'Export prescription PDF | MediLink',
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
