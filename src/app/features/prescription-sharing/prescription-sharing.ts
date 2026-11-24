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
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActiveRoleService } from '../../core/context/active-role.service';
import {
  canShare,
  currentStatus,
  PrescriptionShare,
  PRESCRIPTION_SHARING,
  SharingData,
} from './prescription-sharing.models';
import { PrescriptionSharingPreviewStore } from './prescription-sharing.store';

@Component({
  selector: 'app-prescription-sharing',
  imports: [A11yModule, DatePipe],
  providers: [{ provide: PRESCRIPTION_SHARING, useClass: PrescriptionSharingPreviewStore }],
  templateUrl: './prescription-sharing.html',
  styleUrl: './prescription-sharing.scss',
})
export class PrescriptionSharing implements OnInit, OnDestroy {
  private readonly port = inject(PRESCRIPTION_SHARING);
  private readonly role = inject(ActiveRoleService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  readonly audience =
    this.route.snapshot.data['audience'] === 'pharmacist' ? 'Pharmacist' : 'Patient';
  readonly authorized = computed(
    () =>
      this.role.activeRole() === this.audience &&
      this.role.roles().includes(this.audience) &&
      !!this.role.activeAccountId(),
  );
  readonly data = signal<SharingData>({ prescriptions: [], shares: [], pharmacies: [] });
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly now = signal(Date.now());
  readonly prescriptionId = signal('');
  readonly tokenInput = signal('');
  readonly organizationId = signal('');
  readonly reason = signal('');
  readonly acknowledged = signal(false);
  readonly attempted = signal(false);
  readonly filter = signal('all');
  readonly modal = signal<'code' | 'confirm' | 'revoke' | null>(null);
  readonly selected = signal<PrescriptionShare | null>(null);
  readonly code = signal('');
  readonly scenario = signal('sample');
  readonly canShare = canShare;
  readonly visibleShares = computed(() =>
    this.data().shares.filter((s) => this.filter() === 'all' || this.status(s) === this.filter()),
  );
  private epoch = 0;
  private destroyed = false;
  private timer?: ReturnType<typeof setInterval>;
  private focusTarget = signal('');
  private returnFocus: HTMLElement | null = null;
  private session = '';
  constructor() {
    effect(() => {
      const key = this.authorized() ? this.role.activeAccountId() + ':' + this.audience : '';
      if (key !== this.session) {
        this.session = key;
        this.reset();
        if (key) void this.load();
      }
    });
    afterRenderEffect(() => {
      const target = this.focusTarget();
      if (target) {
        this.host.nativeElement.querySelector<HTMLElement>(target)?.focus();
        this.focusTarget.set('');
      }
      if (!this.modal() && this.returnFocus && !this.busy()) {
        this.returnFocus.focus();
        this.returnFocus = null;
      }
    });
  }
  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      const selected = this.selected();
      if (this.modal() === 'code' && selected && this.status(selected) === 'expired') {
        this.code.set('');
        this.modal.set(null);
        this.message.set('The 15-minute code expired. Create a new share if needed.');
      }
    }, 1000);
  }
  status(share: PrescriptionShare) {
    return currentStatus(share, this.now());
  }
  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
  private reset(): void {
    this.epoch++;
    this.port.clearSession();
    this.data.set({ prescriptions: [], shares: [], pharmacies: [] });
    this.code.set('');
    this.tokenInput.set('');
    this.modal.set(null);
    this.selected.set(null);
    this.reason.set('');
    this.acknowledged.set(false);
    this.error.set('');
    this.message.set('');
    this.busy.set(false);
    this.prescriptionId.set('');
    this.organizationId.set('');
    this.returnFocus = null;
    this.state.set('loading');
  }
  async load(): Promise<void> {
    if (!this.authorized() || this.busy()) return;
    const stamp = ++this.epoch;
    this.state.set('loading');
    this.error.set('');
    this.code.set('');
    try {
      const data = await this.port.load();
      if (!this.valid(stamp)) return;
      if (this.scenario() === 'error') {
        this.scenario.set('sample');
        throw new Error('preview');
      }
      if (this.audience === 'Pharmacist') {
        const sampleId = (
          { confirmed: 'demo-access', expired: 'demo-expired', revoked: 'demo-revoked' } as Record<
            string,
            string
          >
        )[this.scenario()];
        data.shares = data.shares.filter((s) => s.id === (sampleId || this.selected()?.id));
      }
      this.data.set(
        this.scenario() === 'empty' ? { ...data, shares: [], prescriptions: [] } : data,
      );
      this.state.set('ready');
    } catch {
      if (this.valid(stamp)) this.state.set('error');
    }
  }
  changeScenario(event: Event): void {
    if (this.busy()) return;
    this.scenario.set(this.value(event));
    this.close();
    void this.load();
  }
  private valid(stamp: number): boolean {
    return (
      !this.destroyed &&
      this.authorized() &&
      stamp === this.epoch &&
      this.session === this.role.activeAccountId() + ':' + this.audience
    );
  }
  private fail(message: string): void {
    this.error.set(message);
    this.focusTarget.set('[role="alert"]');
  }
  private upsert(share: PrescriptionShare): void {
    this.data.update((data) => ({
      ...data,
      shares: [share, ...data.shares.filter((s) => s.id !== share.id)],
    }));
  }
  async create(event?: Event): Promise<void> {
    if (
      !this.authorized() ||
      this.audience !== 'Patient' ||
      this.busy() ||
      this.state() !== 'ready'
    )
      return;
    if (!this.data().prescriptions.some((p) => p.id === this.prescriptionId() && canShare(p))) {
      this.fail('Choose an active doctor-issued prescription.');
      return;
    }
    this.returnFocus = event?.currentTarget as HTMLElement | null;
    await this.mutate(async () => {
      const result = await this.port.create(this.prescriptionId());
      return () => {
        this.upsert(result.share);
        this.selected.set(result.share);
        this.code.set(result.claimToken);
        this.modal.set('code');
        this.focusTarget.set('#sharing-dialog-title');
      };
    }, 'Unable to create the share. Please try again.');
  }
  async claim(): Promise<void> {
    if (
      !this.authorized() ||
      this.audience !== 'Pharmacist' ||
      this.busy() ||
      this.state() !== 'ready'
    )
      return;
    this.attempted.set(true);
    if (
      !this.tokenInput().trim() ||
      this.tokenInput().trim().length > 256 ||
      !this.data().pharmacies.some((p) => p.id === this.organizationId())
    ) {
      this.fail('Enter a code of 1–256 characters and choose your active pharmacy membership.');
      return;
    }
    const token = this.tokenInput().trim();
    this.tokenInput.set('');
    await this.mutate(async () => {
      const share = await this.port.claim(token, this.organizationId());
      return () => {
        this.selected.set(share);
        this.data.update((d) => ({ ...d, shares: [share] }));
        this.message.set(
          'Sample claim received. Waiting for the patient to verify your pharmacy identity and confirm access.',
        );
        this.attempted.set(false);
      };
    }, 'The code could not be claimed. It may be expired, revoked or already claimed. Check with the patient and try a new code.');
  }
  open(kind: 'confirm' | 'revoke', share: PrescriptionShare, event?: Event): void {
    if (
      !this.authorized() ||
      this.audience !== 'Patient' ||
      this.busy() ||
      !this.actionAllowed(kind, share)
    )
      return;
    this.returnFocus = event?.currentTarget as HTMLElement | null;
    this.selected.set(share);
    this.modal.set(kind);
    this.reason.set('');
    this.acknowledged.set(false);
    this.attempted.set(false);
    this.error.set('');
    this.focusTarget.set('#sharing-dialog-title');
  }
  actionAllowed(kind: 'confirm' | 'revoke', share: PrescriptionShare): boolean {
    return kind === 'confirm'
      ? this.status(share) === 'claimed' && !!share.identity
      : ['created', 'claimed', 'confirmed'].includes(this.status(share));
  }
  async submit(): Promise<void> {
    const selected = this.selected(),
      kind = this.modal();
    if (
      !selected ||
      !kind ||
      kind === 'code' ||
      !this.authorized() ||
      this.audience !== 'Patient' ||
      this.busy()
    )
      return;
    this.now.set(Date.now());
    this.attempted.set(true);
    if (!this.actionAllowed(kind, selected)) {
      this.fail('This share is no longer available for that action. Reload the list.');
      return;
    }
    if (kind === 'confirm' && !this.acknowledged()) {
      this.fail('Check the pharmacist and pharmacy identity, then tick the confirmation.');
      return;
    }
    if (kind === 'revoke' && (!this.reason().trim() || this.reason().trim().length > 1000)) {
      this.fail('Enter a reason of 1–1,000 characters.');
      return;
    }
    await this.mutate(async () => {
      const share =
        kind === 'confirm'
          ? await this.port.confirm(selected.id)
          : await this.port.revoke(selected.id, this.reason().trim());
      return () => {
        this.upsert(share);
        this.modal.set(null);
        this.selected.set(null);
        this.reason.set('');
        this.code.set('');
        this.message.set(
          kind === 'confirm'
            ? 'Sample access confirmed for this prescription only, for 24 hours from confirmation.'
            : 'Sample share revoked. Pharmacy access has ended.',
        );
      };
    }, 'Unable to update this share. Reload to check its current state before retrying.');
  }
  private async mutate(work: () => Promise<() => void>, failure: string): Promise<void> {
    const stamp = this.epoch;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const apply = await work();
      if (this.valid(stamp)) apply();
    } catch {
      if (this.valid(stamp)) this.fail(failure);
    } finally {
      if (this.valid(stamp)) this.busy.set(false);
    }
  }
  close(): void {
    if (this.busy()) return;
    this.modal.set(null);
    this.code.set('');
    this.selected.set(null);
    this.reason.set('');
    this.acknowledged.set(false);
    this.error.set('');
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    clearInterval(this.timer);
    this.reset();
  }
}
