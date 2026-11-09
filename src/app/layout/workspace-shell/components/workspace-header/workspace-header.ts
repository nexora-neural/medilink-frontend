import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActiveRole } from '../../../../core/context/active-role.service';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workspace-header.html',
  styleUrl: './workspace-header.scss',
})
export class WorkspaceHeader {
  private readonly router = inject(Router);

  @Input({ required: true }) activeRole!: ActiveRole;
  @Input() menuOpen = false;

  @Output() menuToggle = new EventEmitter<void>();

  get isDoctorWorkspace(): boolean {
    return this.activeRole === 'Doctor';
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
        if (url.startsWith('/workspace/doctor/patients/')) return 'Patient details';
        return 'Workspace';
    }
  }
}
