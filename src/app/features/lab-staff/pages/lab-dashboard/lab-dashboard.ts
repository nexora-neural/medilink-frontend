import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, MeResponse } from '../../../../core/auth.service';
import { ActiveOrganizationService } from '../../../../core/context/active-organization.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { ReportApi } from '../../../reports/services/report-api.service';
import { LabSummaryCards } from './components/lab-summary-cards/lab-summary-cards';
import { LabUploadRequestsPanel } from './components/lab-upload-requests-panel/lab-upload-requests-panel';
import { LabRecentReportsPanel } from './components/lab-recent-reports-panel/lab-recent-reports-panel';
import {
  LabDashboardReport,
  LabDashboardState,
  LabDashboardSummary,
} from './models/lab-dashboard.models';

interface DashboardResult {
  context: string;
  state: LabDashboardState;
  name?: string;
  summary?: LabDashboardSummary;
  reports?: LabDashboardReport[];
}

@Component({
  selector: 'app-lab-dashboard',
  standalone: true,
  imports: [RouterLink, LabSummaryCards, LabUploadRequestsPanel, LabRecentReportsPanel],
  templateUrl: './lab-dashboard.html',
  styleUrl: './lab-dashboard.scss',
})
export class LabDashboard {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReportApi);
  private readonly roles = inject(ActiveRoleService);
  private readonly organizations = inject(ActiveOrganizationService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly result = signal<DashboardResult | null>(null);
  private version = 0;
  private destroyed = false;

  private readonly permitted = computed(
    () =>
      !!this.roles.activeAccountId() &&
      this.roles.activeRole() === 'Lab Staff' &&
      this.roles.roles().includes('Lab Staff'),
  );

  private readonly context = computed(() =>
    JSON.stringify([
      this.roles.activeAccountId(),
      this.roles.activeRole(),
      this.roles.roles(),
      this.organizations.activeOrganizationId(),
      this.organizations.availableMemberships(),
    ]),
  );

  private readonly current = computed(() => {
    const result = this.result();
    return this.permitted() && result?.context === this.context() ? result : null;
  });

  readonly state = computed<LabDashboardState>(() =>
    !this.permitted() ? 'denied' : (this.current()?.state ?? 'loading'),
  );

  readonly firstName = computed(() => this.current()?.name ?? 'Lab Staff');

  readonly reports = computed(() => this.current()?.reports ?? []);

  readonly summary = computed<LabDashboardSummary>(
    () =>
      this.current()?.summary ?? {
        totalReports: 0,
        laboratory: '',
        verification: '',
      },
  );

  constructor() {
    effect(() => {
      this.context();

      untracked(() => {
        if (this.browser) void this.refresh();
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.version++;
    });
  }

  async refresh(): Promise<void> {
    const version = ++this.version;
    const context = this.context();
    const accountId = this.roles.activeAccountId();

    this.result.set(null);

    if (this.destroyed || !this.permitted()) return;

    const current = () =>
      !this.destroyed && version === this.version && context === this.context() && this.permitted();

    const setState = (state: LabDashboardState) => {
      if (current()) this.result.set({ context, state });
    };

    try {
      const me = await this.auth.getAuthorized<MeResponse>('me');

      if (!current()) return;

      const memberships = me.memberships.filter(
        (membership) =>
          membership.user_id === accountId &&
          membership.role === 'lab_staff' &&
          membership.status === 'approved',
      );

      if (
        me.user.id !== accountId ||
        me.user.status !== 'active' ||
        !me.roles.includes('lab_staff') ||
        me.professional_profile?.role !== 'lab_staff' ||
        me.professional_profile.verification_status !== 'approved' ||
        !memberships.length
      ) {
        setState('denied');
        return;
      }

      // The server checks active laboratories and scopes this list to authorized memberships.
      const page = await this.api.list(null, 1);

      if (!current()) return;

      const statuses = {
        active: 'Published',
        superseded: 'Superseded',
        withdrawn: 'Withdrawn',
      } as const;

      this.result.set({
        context,
        state: page.total === 0 ? 'empty' : 'ready',
        name: me.user.display_name.trim().split(/\s+/)[0] || 'Lab Staff',
        summary: {
          totalReports: page.total,
          laboratory: String(new Set(memberships.map((item) => item.organization_id)).size),
          verification: 'Approved',
        },
        reports: page.items.slice(0, 3).map((report) => ({
          id: report.id,
          type: report.report_type,
          date: report.report_date ?? report.created_at.slice(0, 10),
          reference: report.lab_reference ?? 'No reference',
          status: statuses[report.status],
        })),
      });
    } catch (error: unknown) {
      if (
        (error instanceof HttpErrorResponse && error.status === 401) ||
        (error instanceof Error && error.message === 'Please sign in to continue.')
      ) {
        setState('expired');
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        setState('denied');
      } else {
        setState('error');
      }
    }
  }
}
