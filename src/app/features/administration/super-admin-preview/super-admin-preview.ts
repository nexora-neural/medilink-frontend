import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PreviewData } from './preview-data';

@Component({
  selector: 'app-super-admin-preview',
  imports: [FormsModule, RouterLink],
  templateUrl: './super-admin-preview.html',
  styleUrl: './super-admin-preview.scss',
})
export class SuperAdminPreview {
  private readonly route = inject(ActivatedRoute);
  readonly page = this.route.snapshot.data['previewPage'] as string;
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly data = inject(PreviewData);
  readonly selectedOrganization = computed(() =>
    this.data.organizations().find((item) => item.id === this.id),
  );
  readonly scope = signal(this.data.integrationScope());
  readonly reason = signal('');
  readonly pendingAction = signal('');
  readonly message = signal('');
  readonly reviewRequired = signal(this.data.reviewRequired());
  readonly securityAlerts = signal(this.data.securityAlerts());
  readonly error = computed(() =>
    this.pendingAction() && !this.reason().trim()
      ? 'Enter a reason to confirm this preview action.'
      : '',
  );
  prepare(action: string): void {
    this.pendingAction.set(action);
    this.message.set('');
  }
  confirm(): void {
    const reason = this.reason().trim();
    const action = this.pendingAction();
    if (!reason || (this.page === 'integration-detail' && !this.scope().trim())) return;
    const status = action.startsWith('Approve')
      ? 'Approved'
      : action.startsWith('Reject')
        ? 'Rejected'
        : action.startsWith('Suspend')
          ? 'Suspended'
          : action.startsWith('Revoke')
            ? 'Revoked'
            : '';
    if (this.page === 'organization' && status)
      this.data.organizations.update((items) =>
        items.map((item) => (item.id === this.id ? { ...item, status } : item)),
      );
    if (this.page === 'integration-detail' && status) {
      this.data.integrationStatus.set(status);
      this.data.integrationScope.set(this.scope().trim());
    }
    if (action === 'Resolve incident') this.data.incidentResolved.set(true);
    if (action === 'Resolve membership') this.data.membershipResolved.set(true);
    if (action === 'Save policy') {
      this.data.reviewRequired.set(this.reviewRequired());
      this.data.securityAlerts.set(this.securityAlerts());
    }
    this.data.log(action, reason);
    this.message.set(`${this.pendingAction()} confirmed for this preview only.`);
    this.pendingAction.set('');
    this.reason.set('');
  }
}
