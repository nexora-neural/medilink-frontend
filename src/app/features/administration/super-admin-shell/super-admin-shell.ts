import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SuperAdminSidebar } from '../components/super-admin-sidebar/super-admin-sidebar';
import { SuperAdminHeader } from '../components/super-admin-header/super-admin-header';

@Component({
  selector: 'app-super-admin-shell',
  standalone: true,
  imports: [RouterOutlet, SuperAdminSidebar, SuperAdminHeader],
  templateUrl: './super-admin-shell.html',
  styleUrl: './super-admin-shell.scss',
})
export class SuperAdminShell {
  sidebarOpen = false;
  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  closeSidebar(): void { this.sidebarOpen = false; }
  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeSidebar(); }
}
