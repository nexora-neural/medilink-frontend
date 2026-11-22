import { Routes } from '@angular/router';
import { PrescriptionIssue } from './prescription-issue';
import { PRESCRIPTION_ISSUE, PrescriptionIssuePreviewStore } from './prescription-issue.store';

export const PRESCRIPTION_ISSUE_ROUTES: Routes = [
  {
    path: '',
    component: PrescriptionIssue,
    providers: [
      PrescriptionIssuePreviewStore,
      { provide: PRESCRIPTION_ISSUE, useExisting: PrescriptionIssuePreviewStore },
    ],
  },
];
