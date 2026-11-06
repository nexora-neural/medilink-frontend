import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavigationItem { label: string; icon: string; route?: string; }

@Component({
  selector: 'app-super-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './super-admin-sidebar.html',
  styleUrl: './super-admin-sidebar.scss',
})
export class SuperAdminSidebar {
  readonly isOpen = input(false);
  readonly closeSidebar = output<void>();

  readonly mainItems: NavigationItem[] = [
    { label: 'Overview', icon: 'dashboard' },
    { label: 'Admin accounts', icon: 'manage_accounts' },
    { label: 'Organizations', icon: 'corporate_fare', route: '/super-admin/organizations' },
    { label: 'Membership request', icon: 'assignment_add', route: '/super-admin/membership-request' },
    { label: 'Integrations', icon: 'hub' },
    { label: 'Security', icon: 'security' },
    { label: 'Privileged audit', icon: 'history' },
  ];

  readonly footerItems: NavigationItem[] = [
    { label: 'Settings', icon: 'settings' },
    { label: 'UI states', icon: 'space_dashboard' },
    { label: 'Sign out', icon: 'logout' },
  ];
}
