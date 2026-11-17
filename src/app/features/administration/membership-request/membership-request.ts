import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrganizationsService, PublicOrganization } from '../organizations/organizations.service';

@Component({
  selector: 'app-membership-request',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './membership-request.html',
  styleUrl: './membership-request.scss',
})
export class MembershipRequest implements OnInit {
  private readonly organizationsApi = inject(OrganizationsService);
  readonly organizations = signal<PublicOrganization[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  organizationId: string | null = null;
  professionalRole = '';
  private requestVersion = 0;

  ngOnInit(): void {
    void this.loadOrganizations();
  }

  async loadOrganizations(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const organizations = await this.organizationsApi.listPublicOrganizations();
      if (version === this.requestVersion) this.organizations.set(organizations);
    } catch {
      if (version === this.requestVersion) {
        this.error.set('Organizations could not be loaded. Please try again.');
      }
    } finally {
      if (version === this.requestVersion) this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.success.set('');
    if (!this.organizationId || !this.professionalRole) {
      this.error.set('Choose an organization and professional role.');
      return;
    }
    if (!this.organizations().some((item) => item.id === this.organizationId)) {
      this.error.set('Choose an active organization from the list.');
      return;
    }

    this.submitting.set(true);
    try {
      const membership = await this.organizationsApi.requestMembership(
        this.organizationId,
        this.professionalRole,
      );
      const organization = this.organizations().find(
        (item) => item.id === membership.organization_id,
      );
      this.success.set(
        `Your ${membership.role.replaceAll('_', ' ')} membership request${organization ? ` for ${organization.name}` : ''} was submitted and is pending review.`,
      );
    } catch (error: unknown) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 409) {
        this.error.set('A request for this organization and role already exists.');
      } else if (status === 403) {
        this.error.set('Your account is not eligible to request this professional role.');
      } else if (status === 404) {
        await this.loadOrganizations();
        this.error.set('This organization is not currently accepting membership requests.');
      } else {
        this.error.set('Your request could not be submitted. Please try again.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  retryLoad(): void {
    void this.loadOrganizations();
  }
}
