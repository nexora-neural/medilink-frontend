import { Component, HostListener, output, inject, input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-super-admin-header',
  standalone: true,
  templateUrl: './super-admin-header.html',
  styleUrl: './super-admin-header.scss',
})
export class SuperAdminHeader {
  readonly sidebarOpen = input(false);
  readonly menuToggle = output<HTMLButtonElement>();
  private readonly router = inject(Router);
  profileOpen = false;
  notificationsOpen = false;

  get pageTitle(): string {
    const url = this.router.url;
    if (url.includes('/admin-accounts')) return 'Admin accounts';
    if (url.includes('/account-support')) return 'Account support';
    if (/\/applications\/[^/?#]+/.test(url)) return 'Application review';
    if (url.includes('/applications')) return 'Professional applications';
    if (url.includes('/membership-request')) return 'Membership request';
    if (/\/organizations\/[^/?]+/.test(url)) return 'Organization details';
    return 'Organizations';
  }

  toggleProfile(): void {
    this.profileOpen = !this.profileOpen;
    this.notificationsOpen = false;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    this.profileOpen = false;
  }

  @HostListener('document:keydown.escape')
  dismissPopovers(): void {
    this.profileOpen = false;
    this.notificationsOpen = false;
  }
}
