import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import { PatientNotificationPreviewStore } from '../../../../features/patients/pages/patient-notifications/patient-notification-preview.store';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workspace-header.html',
  styleUrl: './workspace-header.scss',
})
export class WorkspaceHeader {
  private readonly router = inject(Router);
  private readonly roles = inject(ActiveRoleService);
  private readonly notificationStore = inject(PatientNotificationPreviewStore);

  @Input({ required: true }) activeRole!: ActiveRole;
  @Input() menuOpen = false;

  @Output() menuToggle = new EventEmitter<void>();

  get isDoctorWorkspace(): boolean {
    return this.activeRole === 'Doctor';
  }

  get patientUnreadCount(): number {
    return this.activeRole === 'Patient'
      ? this.notificationStore.unreadCountFor(this.roles.activeAccountId())
      : 0;
  }

  get doctorPageTitle(): string {
    const url = this.router.url.split(/[?#]/)[0];

    switch (url) {
      case '/workspace/doctor/dashboard':
        return 'Dashboard';

      case '/workspace/doctor/records':
        return 'Patient records';

      case '/workspace/doctor/prescriptions':
        return 'Prescriptions';

      case '/workspace/doctor/patients':
        return 'Patients';
      case '/workspace/doctor/qr':
        return 'My QR code';
      case '/workspace/doctor/verification':
      case '/workspace/professional-verification':
        return 'Verification';
      case '/workspace/doctor/notifications':
        return 'Notifications';
      case '/workspace/doctor/prescription-review':
        return 'Prescription review';
      case '/workspace/doctor/reports':
        return 'Laboratory reports';

      default:
        if (/^\/workspace\/doctor\/prescriptions\/[^/]+\/issue$/.test(url))
          return 'Review & issue prescription';
        if (url.startsWith('/workspace/doctor/patients/')) return 'Patient details';
        return 'Workspace';
    }
  }
}
