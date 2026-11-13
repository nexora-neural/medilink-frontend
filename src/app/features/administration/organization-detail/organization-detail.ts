import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  MembershipDecisionStatus,
  MembershipStatus,
  Organization,
  OrganizationDecisionStatus,
  OrganizationMembership,
  OrganizationStatus,
  OrganizationsService,
} from '../organizations/organizations.service';

type PendingDecision =
  | { target: 'organization'; status: OrganizationDecisionStatus }
  | {
      target: 'membership';
      membershipId: string;
      status: MembershipDecisionStatus;
    };

@Component({
  selector: 'app-admin-organization-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, ReactiveFormsModule, TitleCasePipe],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.scss',
})
export class OrganizationDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationsApi = inject(OrganizationsService);

  readonly organization = signal<Organization | null>(null);
  readonly memberships = signal<OrganizationMembership[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly decisionError = signal('');
  readonly feedback = signal('');
  readonly pendingDecision = signal<PendingDecision | null>(null);
  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  private organizationId = '';

  ngOnInit(): void {
    this.organizationId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.loadOrganization();
  }

  async loadOrganization(): Promise<void> {
    if (!this.organizationId) {
      this.loading.set(false);
      this.loadError.set('The organization identifier is missing.');
      return;
    }

    this.loading.set(true);
    this.loadError.set('');
    this.decisionError.set('');

    try {
      const [organization, memberships] = await Promise.all([
        this.organizationsApi.getOrganization(this.organizationId),
        this.organizationsApi.listMemberships(this.organizationId),
      ]);
      this.organization.set(organization);
      this.memberships.set(memberships);
    } catch (error) {
      this.loadError.set(this.errorMessage(error, 'Organization details could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  organizationStatusLabel(status: OrganizationStatus): string {
    if (status === 'active') return 'Approved';
    return this.titleCase(status);
  }

  membershipStatusLabel(status: MembershipStatus): string {
    return this.titleCase(status);
  }

  canApproveOrganization(status: OrganizationStatus): boolean {
    return status === 'pending' || status === 'suspended';
  }

  canRejectOrganization(status: OrganizationStatus): boolean {
    return status === 'pending' || status === 'active' || status === 'suspended';
  }

  canSuspendOrganization(status: OrganizationStatus): boolean {
    return status === 'active';
  }

  canReviewMembership(status: MembershipStatus): boolean {
    return ['pending', 'more_info_requested', 'approved', 'suspended'].includes(status);
  }

  prepareOrganizationDecision(status: OrganizationDecisionStatus): void {
    this.prepareDecision({ target: 'organization', status });
  }

  prepareMembershipDecision(membershipId: string, status: MembershipDecisionStatus): void {
    this.prepareDecision({ target: 'membership', membershipId, status });
  }

  cancelDecision(): void {
    this.pendingDecision.set(null);
    this.reason.reset('');
    this.decisionError.set('');
  }

  async confirmDecision(): Promise<void> {
    const decision = this.pendingDecision();
    const reason = this.reason.value.trim();
    this.reason.markAsTouched();

    if (!decision || !reason || this.reason.invalid || this.saving()) {
      if (!reason) this.reason.setErrors({ required: true });
      return;
    }

    this.saving.set(true);
    this.decisionError.set('');
    this.feedback.set('');

    try {
      if (decision.target === 'organization') {
        this.organization.set(
          await this.organizationsApi.decideOrganization(
            this.organizationId,
            decision.status,
            reason,
          ),
        );
        this.feedback.set(
          `Organization decision saved: ${this.organizationStatusLabel(decision.status)}.`,
        );
      } else {
        const updated = await this.organizationsApi.decideMembership(
          decision.membershipId,
          decision.status,
          reason,
        );
        this.memberships.update((memberships) =>
          memberships.map((membership) => (membership.id === updated.id ? updated : membership)),
        );
        this.feedback.set(
          `Membership decision saved: ${this.membershipStatusLabel(decision.status)}.`,
        );
      }

      this.cancelDecision();
    } catch (error) {
      this.decisionError.set(this.errorMessage(error, 'The decision could not be saved.'));
    } finally {
      this.saving.set(false);
    }
  }

  private prepareDecision(decision: PendingDecision): void {
    this.pendingDecision.set(decision);
    this.reason.reset('');
    this.decisionError.set('');
    this.feedback.set('');
  }

  private titleCase(value: string): string {
    return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return 'Your account is not permitted to manage this organization workflow.';
      }
      if (status === 404)
        return 'This organization or membership could not be found. Refresh and try again.';
      if (status === 409 || status === 422) {
        return 'This decision is not valid for the current status. Refresh the page and try again.';
      }
    }
    return fallback;
  }
}
