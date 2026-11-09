import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ActiveRole, ActiveRoleService } from '../../core/context/active-role.service';
import { WorkspaceHeader } from './components/workspace-header/workspace-header';
import { WorkspaceSidebar } from './components/workspace-sidebar/workspace-sidebar';

import { NavigationItem } from './models/navigation-item';

const navigationByRole: Record<ActiveRole, NavigationItem[]> = {
  Admin: [
    {
      label: 'Account support',
      icon: 'support_agent',
      path: '/workspace/admin/account-support',
    },
  ],
  'Super Admin': [
    { label: 'Organizations', icon: 'business', path: '/super-admin/organizations' },
    { label: 'Professional applications', icon: 'fact_check', path: '/super-admin/applications' },
  ],
  Patient: [
    { label: 'Overview', icon: 'dashboard', path: '/workspace' },
    { label: 'Medications', icon: 'medication', path: '/workspace/patient/medications' },
    { label: 'Prescriptions', icon: 'prescriptions', path: '/workspace/patient/prescriptions' },
    { label: 'Medical history', icon: 'clinical_notes', path: '/workspace/patient/history' },
    { label: 'Reports', icon: 'description', path: '/workspace/patient/reports' },
    { label: 'Measurements', icon: 'monitor_heart', path: '/workspace/patient/measurements' },
    { label: 'Vaccinations', icon: 'vaccines', path: '/workspace/patient/vaccinations' },
    { label: 'Doctor access', icon: 'shield_person', path: '/workspace/patient/access' },
    {
      label: 'Professional verification',
      icon: 'verified_user',
      path: '/workspace/professional-verification',
    },
  ],

  Doctor: [
    { label: 'Overview', icon: 'dashboard', path: '/workspace/doctor/dashboard' },
    { label: 'Patients', icon: 'group', path: '/workspace/doctor/patients' },
    { label: 'My QR code', icon: 'qr_code_2', path: '/workspace/doctor/qr' },
    { label: 'Verification', icon: 'verified_user', path: '/workspace/professional-verification' },
    { label: 'Notifications', icon: 'notifications', path: '/workspace/doctor/notifications' },
    { label: 'Patient records', icon: 'clinical_notes', path: '/workspace/doctor/records' },
    { label: 'Prescriptions', icon: 'prescriptions', path: '/workspace/doctor/prescriptions' },
  ],

  Pharmacist: [
    { label: 'Overview', icon: 'dashboard', path: '/workspace' },
    { label: 'Dispensing', icon: 'medication', path: '/workspace/pharmacist/dispensing' },
    { label: 'Verification', icon: 'verified_user', path: '/workspace/professional-verification' },
  ],
  'Lab Staff': [
    { label: 'Overview', icon: 'dashboard', path: '/workspace' },
    { label: 'Laboratory reports', icon: 'science', path: '/workspace/lab-staff/reports' },
    { label: 'Verification', icon: 'verified_user', path: '/workspace/professional-verification' },
  ],
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [WorkspaceHeader, WorkspaceSidebar, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  readonly roleContext = inject(ActiveRoleService);
  readonly activeRole = this.roleContext.activeRole;
  readonly roles = this.roleContext.roles;
  readonly navigation = computed(() => navigationByRole[this.activeRole()]);
  menuOpen = false;

  selectRole(role: ActiveRole): void {
    this.roleContext.setActiveRole(role);
    this.menuOpen = false;
    void this.router.navigate(['/workspace']);
  }

  get isDoctorDashboardRoute(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/workspace/doctor/dashboard';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
