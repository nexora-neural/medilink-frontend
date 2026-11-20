import { A11yModule } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { UiState } from '../../../shared/components/ui-state/ui-state';
import {
  ApprovedLab,
  canAct,
  ClientAction,
  ClientStatus,
  effectiveStatus,
  IntegrationClient,
  outcomeExplanation,
  SubmissionOutcome,
} from './integration-clients.models';
import { INTEGRATION_CLIENTS, IntegrationClientsPreviewStore } from './integration-clients.store';

@Component({
  selector: 'app-integration-clients',
  imports: [A11yModule, DatePipe, ReactiveFormsModule, RouterLink, RouterLinkActive, UiState],
  templateUrl: './integration-clients.html',
  styleUrl: './integration-clients.scss',
})
export class IntegrationClients implements OnInit, OnDestroy {
  private readonly port = inject(INTEGRATION_CLIENTS);
  private readonly roles = inject(ActiveRoleService);
  private readonly fb = inject(FormBuilder);
  private destroyed = false;
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  readonly outcomesView = inject(ActivatedRoute).snapshot.data['view'] === 'outcomes';
  readonly canManage = computed(() => this.roles.activeRole() === 'Super Admin');
  readonly clients = signal<IntegrationClient[]>([]);
  readonly labs = signal<ApprovedLab[]>([]);
  readonly submissions = signal<SubmissionOutcome[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly saving = signal(false);
  readonly message = signal('');
  readonly actionError = signal('');
  readonly modal = signal<'approve' | ClientAction | 'credential' | null>(null);
  readonly selected = signal<IntegrationClient | null>(null);
  readonly credential = signal<string | null>(null);
  readonly credentialClient = signal('');
  readonly query = signal('');
  readonly filter = signal<ClientStatus | ''>('');
  readonly outcomeFilter = signal('');
  readonly canAct = canAct;
  readonly status = effectiveStatus;
  readonly explain = outcomeExplanation;
  readonly statuses: ClientStatus[] = ['pending', 'active', 'suspended', 'revoked', 'expired'];
  readonly outcomeStatuses = ['received', 'processing', 'accepted', 'rejected', 'failed'];
  readonly filtered = computed(() =>
    this.clients().filter(
      (client) =>
        (!this.filter() || effectiveStatus(client) === this.filter()) &&
        `${client.name} ${client.organizationName} ${client.id}`
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
    ),
  );
  readonly visibleOutcomes = computed(() =>
    this.submissions().filter(
      (item) =>
        (!this.outcomeFilter() || item.status === this.outcomeFilter()) &&
        `${item.id} ${item.clientId}`.toLowerCase().includes(this.query().trim().toLowerCase()),
    ),
  );
  readonly form = this.fb.nonNullable.group({
    organizationId: [''],
    name: ['', Validators.maxLength(200)],
    expiresAt: [''],
    reason: ['', Validators.maxLength(1000)],
  });

  constructor() {
    afterRenderEffect(() => {
      this.modal();
      const selector = this.actionError() ? '[role="alert"]' : 'h2';
      this.panel()?.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
    effect(() => {
      if (!this.canManage()) {
        this.credential.set(null);
        this.modal.set(null);
        this.selected.set(null);
        this.clients.set([]);
        this.submissions.set([]);
      }
    });
  }

  ngOnInit(): void {
    void this.load();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.credential.set(null);
  }

  async load(): Promise<void> {
    if (!this.canManage() || this.saving() || this.modal()) return;
    this.state.set('loading');
    try {
      const [clients, labs, submissions] = await Promise.all([
        this.port.listClients(),
        this.port.listApprovedLabs(),
        this.port.listSubmissions(),
      ]);
      if (this.destroyed || !this.canManage()) return;
      this.clients.set(clients);
      this.labs.set(labs);
      this.submissions.set(submissions);
      this.state.set('ready');
    } catch {
      this.clients.set([]);
      this.labs.set([]);
      this.submissions.set([]);
      this.state.set('error');
    }
  }

  open(action: 'approve' | ClientAction, client?: IntegrationClient): void {
    if (
      !this.canManage() ||
      this.saving() ||
      this.modal() ||
      this.state() !== 'ready' ||
      (action !== 'approve' && (!client || !canAct(client, action)))
    )
      return;
    this.form.reset();
    this.actionError.set('');
    this.message.set('');
    this.selected.set(client ?? null);
    this.modal.set(action);
  }

  close(): void {
    if (this.saving()) return;
    this.credential.set(null);
    this.credentialClient.set('');
    this.modal.set(null);
    this.selected.set(null);
    this.form.reset();
    this.actionError.set('');
  }

  async confirm(): Promise<void> {
    const action = this.modal();
    if (!this.canManage() || this.saving() || !action || action === 'credential') return;
    this.actionError.set('');
    this.form.markAllAsTouched();
    const values = this.form.getRawValue();
    const name = values.name.trim();
    const reason = values.reason.trim();
    const expiry = Date.parse(values.expiresAt);
    if (
      this.form.invalid ||
      ((action === 'approve' || action === 'rotate') &&
        (!Number.isFinite(expiry) || expiry <= Date.now())) ||
      (action === 'approve' &&
        (!name || !this.labs().some((lab) => lab.id === values.organizationId))) ||
      (action !== 'approve' && !reason) ||
      /\0/.test(name + reason)
    ) {
      this.actionError.set(
        'Check the required fields. Use a future expiry, a name up to 200 characters and a reason up to 1,000 characters.',
      );
      return;
    }
    const current = this.clients().find((item) => item.id === this.selected()?.id);
    if (action !== 'approve' && (!current || !canAct(current, action))) {
      this.actionError.set('Client status has changed. Close this dialog and reload.');
      return;
    }
    this.saving.set(true);
    try {
      const result =
        action === 'approve'
          ? await this.port.approve({
              organizationId: values.organizationId,
              name,
              scopes: ['reports:write'],
              expiresAt: new Date(expiry).toISOString(),
            })
          : await this.port.change(
              current!.id,
              action,
              reason,
              action === 'rotate' ? new Date(expiry).toISOString() : undefined,
            );
      if (this.destroyed || !this.canManage()) return;
      const client = 'client' in result ? result.client : result;
      if (current && client.id !== current.id) throw new Error('Unexpected action result');
      this.clients.update((items) =>
        items.some((item) => item.id === client.id)
          ? items.map((item) => (item.id === client.id ? client : item))
          : [...items, client],
      );
      this.form.reset();
      this.selected.set(null);
      if ('credential' in result) {
        this.credential.set(result.credential);
        this.credentialClient.set(client.name);
        this.modal.set('credential');
      } else this.modal.set(null);
      this.message.set('Sample change applied for this preview. Production access is unchanged.');
    } catch {
      if (!this.destroyed && this.canManage())
        this.actionError.set(
          'Could not confirm the change. Close this dialog and reload before retrying.',
        );
    } finally {
      this.saving.set(false);
    }
  }
}
