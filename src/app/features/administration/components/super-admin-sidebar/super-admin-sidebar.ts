import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavigationItem {
  label: string;
  icon: string;
  route?: string;
}

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
    {
      label: 'Admin accounts',
      icon: 'manage_accounts',
      route: '/super-admin/admin-accounts',
    },
    { label: 'Organizations', icon: 'corporate_fare', route: '/super-admin/organizations' },
    {
      label: 'Membership request',
      icon: 'assignment_add',
      route: '/super-admin/membership-request',
    },
    {
      label: 'Professional applications',
      icon: 'fact_check',
      route: '/super-admin/applications',
    },
    { label: 'Integrations', icon: 'hub' },
    { label: 'Security', icon: 'security' },
    { label: 'Privileged audit', icon: 'history' },
    {
      label: 'Account support',
      icon: 'support_agent',
      route: '/super-admin/account-support',
    },
  ];

  readonly footerItems: NavigationItem[] = [
    { label: 'Settings', icon: 'settings' },
    { label: 'UI states', icon: 'space_dashboard' },
    { label: 'Sign out', icon: 'logout' },
  ];
}
