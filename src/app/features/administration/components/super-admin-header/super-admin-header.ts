import { Component, HostListener, output, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-super-admin-header',
  standalone: true,
  templateUrl: './super-admin-header.html',
  styleUrl: './super-admin-header.scss',
})
export class SuperAdminHeader {
  readonly menuToggle = output<void>();
  private readonly router = inject(Router);
  profileOpen = false;
  notificationsOpen = false;

  get pageTitle(): string {
    const url = this.router.url;
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
  dismissPopovers(): void { this.profileOpen = false; this.notificationsOpen = false; }
}
