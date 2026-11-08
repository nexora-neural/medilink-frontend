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

      default:
        return 'Workspace';
    }
  }
}
