import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

export type OrganizationStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'inactive';
export type MembershipStatus =
  'not_submitted' | 'pending' | 'approved' | 'rejected' | 'more_info_requested' | 'suspended';
export type OrganizationDecisionStatus = 'active' | 'rejected' | 'suspended';
export type MembershipDecisionStatus = 'approved' | 'rejected';

export interface Organization {
  id: string;
  name: string;
  type: string;
  registration_ref: string | null;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: MembershipStatus;
  verified_at: string | null;
  created_at: string;
}

interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class OrganizationsService {
  private readonly auth = inject(AuthService);

  async listOrganizations(): Promise<Organization[]> {
    return this.collectPages<Organization>('/admin/organizations');
  }

  getOrganization(id: string): Promise<Organization> {
    return this.auth.getAuthorized<Organization>(`admin/organizations/${encodeURIComponent(id)}`);
  }

  async listMemberships(organizationId: string): Promise<OrganizationMembership[]> {
    const query = new URLSearchParams({
      organization_id: organizationId,
    });
    return this.collectPages<OrganizationMembership>(`/admin/memberships?${query}`);
  }

  decideOrganization(
    id: string,
    status: OrganizationDecisionStatus,
    reason: string,
  ): Promise<Organization> {
    return this.auth.postAuthorized<Organization>(
      `admin/organizations/${encodeURIComponent(id)}/decision`,
      { status, reason: reason.trim() },
    );
  }

  decideMembership(
    id: string,
    status: MembershipDecisionStatus,
    reason: string,
  ): Promise<OrganizationMembership> {
    return this.auth.postAuthorized<OrganizationMembership>(
      `admin/memberships/${encodeURIComponent(id)}/decision`,
      { status, reason: reason.trim() },
    );
  }

  private async collectPages<T>(path: string): Promise<T[]> {
    const separator = path.includes('?') ? '&' : '?';
    const items: T[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    while (items.length < total) {
      const query = new URLSearchParams({ page: String(page), page_size: '100' });
      const result = await this.auth.getAuthorized<Page<T>>(
        `${path}${separator}${query.toString()}`,
      );
      items.push(...result.items);
      total = result.total;
      if (!result.items.length) break;
      page += 1;
    }

    return items;
  }
}
