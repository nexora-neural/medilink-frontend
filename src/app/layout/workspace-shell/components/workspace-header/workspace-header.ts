import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveRole } from '../../../../core/context/active-role.service';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workspace-header.html',
  styleUrl: './workspace-header.scss',
})
export class WorkspaceHeader {
  @Input({ required: true }) activeRole!: ActiveRole;
  @Input() menuOpen = false;

  @Output() menuToggle = new EventEmitter<void>();
}
