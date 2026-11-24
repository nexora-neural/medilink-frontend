import { CanDeactivateFn, Routes } from '@angular/router';
import { ReportWorkspace } from './report-workspace';
import { ReportCorrectionPage } from './pages/report-correction-page/report-correction-page';
import { ReportWithdrawalPage } from './pages/report-withdrawal-page/report-withdrawal-page';
import { ReportDetailPage } from './pages/report-detail-page/report-detail-page';
import { ReportListPage } from './pages/report-list-page/report-list-page';
const leaveReport: CanDeactivateFn<ReportCorrectionPage | ReportWithdrawalPage> = (page) =>
  page.canLeave();
export const REPORT_CORRECTION_ROUTES: Routes = [
  {
    path: '',
    component: ReportWorkspace,
    children: [
      { path: '', component: ReportListPage, title: 'Uploaded reports | MediLink' },
      {
        path: ':id/correct',
        component: ReportCorrectionPage,
        canDeactivate: [leaveReport],
        title: 'Correct report | MediLink',
      },
      {
        path: ':id/withdraw',
        component: ReportWithdrawalPage,
        canDeactivate: [leaveReport],
        title: 'Withdraw report | MediLink',
      },
      { path: ':id', component: ReportDetailPage, title: 'Report details | MediLink' },
    ],
  },
];
