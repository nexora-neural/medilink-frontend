import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface OrganizationOption {
  id: number;
  name: string;
  type: string;
  approved: boolean;
}

@Component({
  selector: 'app-membership-request',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './membership-request.html',
  styleUrl: './membership-request.scss',
})
export class MembershipRequest {
  readonly organizations: OrganizationOption[] = [
    { id: 1, name: 'Lakeside Clinic', type: 'Clinic', approved: true },
    { id: 2, name: 'Central Laboratory', type: 'Laboratory', approved: false },
    { id: 3, name: 'Lakeside Pharmacy', type: 'Pharmacy', approved: true },
  ];
  organizationId: number | null = null;
  fullName = '';
  email = '';
  professionalRole = '';
  reason = '';
  submitted = false;
  error = '';
  success = '';
  loading = false;

  submit(): void {
    this.submitted = true;
    this.error = '';
    this.success = '';
    const selected = this.organizations.find(
      (item) => item.id === Number(this.organizationId) && item.approved,
    );
    if (!selected) {
      this.error = 'Choose an approved organization.';
      return;
    }
    if (
      !this.fullName.trim() ||
      !this.email.trim() ||
      !this.professionalRole ||
      !this.reason.trim()
    ) {
      this.error = 'Complete all required fields.';
      return;
    }
    if (this.reason.trim().length < 10) {
      this.error = 'Reason must contain at least 10 characters.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error = 'Enter a valid email address.';
      return;
    }
    this.success = `Membership request for ${selected.name} validated locally. Nothing was submitted to the server.`;
    this.submitted = false;
  }
}
