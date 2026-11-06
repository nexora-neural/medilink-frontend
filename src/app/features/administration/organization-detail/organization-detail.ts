import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

type OrganizationStatus = 'Approved' | 'Pending' | 'Rejected' | 'Suspended';
interface Member { id: number; name: string; role: string; status: 'Approved' | 'Pending' | 'Rejected'; }
interface Organization { id: number; name: string; type: string; status: OrganizationStatus; members: Member[]; }

@Component({
  selector: 'app-admin-organization-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.scss',
})
export class OrganizationDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  // Local demo content only. No API or imported mock file.
  readonly organizations: Organization[] = [
    { id: 1, name: 'Lakeside Clinic', type: 'Clinic', status: 'Approved', members: [
      { id: 11, name: 'Dr. Kasun Perera', role: 'Doctor', status: 'Approved' },
      { id: 12, name: 'Dr. Nadeesha Silva', role: 'Doctor', status: 'Pending' },
    ] },
    { id: 2, name: 'Central Laboratory', type: 'Laboratory', status: 'Pending', members: [
      { id: 21, name: 'Nimali Fernando', role: 'Lab Staff', status: 'Pending' },
    ] },
    { id: 3, name: 'Lakeside Pharmacy', type: 'Pharmacy', status: 'Approved', members: [
      { id: 31, name: 'Amal Silva', role: 'Pharmacist', status: 'Approved' },
    ] },
  ];
  organization?: Organization;
  reason = '';
  error = '';
  feedback = '';
  pendingDecision: OrganizationStatus | null = null;
  memberDecision: { memberId: number; status: Member['status'] } | null = null;
  loading = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.organization = this.organizations.find(item => item.id === id);
  }
  prepareOrganizationDecision(status: OrganizationStatus): void {
    this.clearNotices();
    if (!this.reason.trim()) { this.error = 'Enter a reason before continuing.'; return; }
    this.pendingDecision = status;
  }
  confirmOrganizationDecision(): void {
    if (!this.organization || !this.pendingDecision || !this.reason.trim()) return;
    this.organization.status = this.pendingDecision;
    this.feedback = `Organization marked ${this.pendingDecision.toLowerCase()} locally. No changes were sent.`;
    this.pendingDecision = null;
    this.reason = '';
  }
  prepareMemberDecision(memberId: number, status: Member['status']): void {
    this.clearNotices();
    if (!this.reason.trim()) { this.error = 'Enter a reason before continuing.'; return; }
    this.memberDecision = { memberId, status };
  }
  confirmMemberDecision(): void {
    if (!this.organization || !this.memberDecision || !this.reason.trim()) return;
    const member = this.organization.members.find(item => item.id === this.memberDecision?.memberId);
    if (member) {
      member.status = this.memberDecision.status;
      this.feedback = `Membership marked ${member.status.toLowerCase()} locally. No changes were sent.`;
    }
    this.memberDecision = null;
    this.reason = '';
  }
  cancelDecision(): void { this.pendingDecision = null; this.memberDecision = null; }
  private clearNotices(): void { this.error = ''; this.feedback = ''; this.cancelDecision(); }
}
