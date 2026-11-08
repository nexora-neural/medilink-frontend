import {
  afterNextRender,
  Component,
  ElementRef,
  HostListener,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
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
  private readonly injector = inject(Injector);
  private readonly sidebar = viewChild.required('sidebar', { read: ElementRef<HTMLElement> });
  private menuButton?: HTMLButtonElement;
  sidebarOpen = false;

  toggleSidebar(button: HTMLButtonElement): void {
    if (this.sidebarOpen) {
      this.closeSidebar();
      return;
    }

    this.menuButton = button;
    this.sidebarOpen = true;
    afterNextRender(
      () => {
        if (this.sidebarOpen) {
          this.sidebar().nativeElement.querySelector('a')?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  closeSidebar(): void {
    if (!this.sidebarOpen) return;
    this.sidebarOpen = false;
    this.menuButton?.focus();
  }
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
  }
}
