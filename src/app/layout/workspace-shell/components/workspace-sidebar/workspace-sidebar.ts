import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Router,
  RouterLink, RouterLinkActive } from '@angular/router';
import { ActiveRole } from '../../../../core/context/active-role.service';
import { NavigationItem } from '../../models/navigation-item';

@Component({
  selector: 'app-workspace-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './workspace-sidebar.html',
  styleUrl: './workspace-sidebar.scss',
})
export class WorkspaceSidebar {
  private readonly router = inject(Router);

  @Input({ required: true }) activeRole!: ActiveRole;
  @Input({ required: true }) navigation: NavigationItem[] = [];
  @Input({ required: true }) roles: ActiveRole[] = [];
  @Input() menuOpen = false;

  @Output() roleChange = new EventEmitter<ActiveRole>();
  @Output() closeMenu = new EventEmitter<void>();

  get isDoctorWorkspace(): boolean {
    return this.activeRole === 'Doctor';
  }

  selectRole(event: Event): void {
    this.roleChange.emit((event.target as HTMLSelectElement).value as ActiveRole);
  }
}
