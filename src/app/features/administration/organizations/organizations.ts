import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Organization, OrganizationStatus, OrganizationsService } from './organizations.service';

@Component({
  selector: 'app-admin-organizations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './organizations.html',
  styleUrl: './organizations.scss',
})
export class Organizations implements OnInit {
  private readonly organizationsApi = inject(OrganizationsService);
  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    void this.loadOrganizations();
  }

  async loadOrganizations(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.organizations.set(await this.organizationsApi.listOrganizations());
    } catch {
      this.error.set('Organizations could not be loaded. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(status: OrganizationStatus): string {
    if (status === 'active') return 'Approved';
    return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  }
}
