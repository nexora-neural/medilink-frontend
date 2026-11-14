import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

export type SupportAccountStatus = 'active' | 'pending' | 'suspended' | 'disabled';

export interface SupportUser {
  id: string;
  email: string | null;
  display_name: string;
  phone: string | null;
  status: SupportAccountStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportUsersPage {
  items: SupportUser[];
  page: number;
  page_size: number;
  total: number;
}

export interface SupportActionResult {
  id: string;
  status: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AccountSupportApiService {
  private readonly auth = inject(AuthService);

  searchUsers(query: string, page = 1, status?: SupportAccountStatus): Promise<SupportUsersPage> {
    let params = new HttpParams().set('page', page).set('page_size', 20);

    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      params = params.set('q', trimmedQuery);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.auth.getAuthorized<SupportUsersPage>(`/admin/users?${params.toString()}`);
  }

  updateStatus(
    userId: string,
    status: 'active' | 'suspended' | 'disabled',
    reason: string,
  ): Promise<SupportUser> {
    return this.auth.postAuthorized<SupportUser>(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      { status, reason: reason.trim() },
    );
  }

  appointAdmin(userId: string, reason: string): Promise<SupportActionResult> {
    return this.auth.postAuthorized<SupportActionResult>('/admin/role-assignments', {
      user_id: userId,
      role: 'admin',
      reason: reason.trim(),
    });
  }

  revokeAdmin(userId: string, reason: string): Promise<SupportActionResult> {
    return this.auth.postAuthorized<SupportActionResult>(
      `/admin/users/${encodeURIComponent(userId)}/admin-role/revoke`,
      { reason: reason.trim() },
    );
  }
}
