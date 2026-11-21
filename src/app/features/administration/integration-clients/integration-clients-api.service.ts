import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type {
  ApprovedLab,
  ClientAction,
  ClientApproval,
  ClientStatus,
  CredentialResult,
  IntegrationClient,
  SubmissionOutcome,
} from './integration-clients.models';
import type { IntegrationClientsPort } from './integration-clients.store';

const CLIENTS_PATH = '/admin/integration-clients';
const SUBMISSIONS_PATH = '/admin/integration-submissions';
const REPORTS_WRITE_SCOPE = 'reports:write';

interface ApiPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

interface ClientDto {
  id: string;
  organization_id: string;
  name: string;
  status: ClientStatus;
  scopes: string[];
  expires_at: string;
}

interface CredentialDto {
  client: ClientDto;
  credential: string;
}

interface SubmissionDto {
  id: string;
  client_id: string;
  status: SubmissionOutcome['status'];
  received_at: string;
  error_code: string | null;
}

@Injectable()
export class IntegrationClientsApiService implements IntegrationClientsPort {
  private readonly auth = inject(AuthService);
  private readonly organizations = inject(OrganizationsService);
  private readonly organizationNames = new Map<string, string>();

  async listClients(): Promise<IntegrationClient[]> {
    const clients = await this.readAllPages<ClientDto>(CLIENTS_PATH);
    if (!clients.length) return [];

    const organizations = await this.organizations.listOrganizations();
    for (const { id, name } of organizations) {
      this.organizationNames.set(id, name);
    }

    return clients.map((client) => this.toClient(client));
  }

  async listApprovedLabs(): Promise<ApprovedLab[]> {
    const organizations = await this.organizations.listPublicOrganizations();
    const labs = organizations
      .filter((organization) => organization.type === 'laboratory')
      .map(({ id, name }) => ({ id, name }));

    for (const { id, name } of labs) {
      this.organizationNames.set(id, name);
    }

    return labs;
  }

  async listSubmissions(): Promise<SubmissionOutcome[]> {
    const submissions = await this.readAllPages<SubmissionDto>(SUBMISSIONS_PATH);

    return submissions.map((submission) => ({
      id: submission.id,
      clientId: submission.client_id,
      status: submission.status,
      receivedAt: submission.received_at,
      errorCode: submission.error_code,
    }));
  }

  async approve(input: ClientApproval): Promise<CredentialResult> {
    const result = await this.auth.postAuthorized<CredentialDto>(CLIENTS_PATH, {
      organization_id: input.organizationId,
      name: input.name.trim(),
      scopes: [REPORTS_WRITE_SCOPE],
      expires_at: input.expiresAt,
    });
    return { client: this.toClient(result.client), credential: result.credential };
  }

  async change(
    id: string,
    action: ClientAction,
    reason: string,
    expiresAt?: string,
  ): Promise<CredentialResult | IntegrationClient> {
    const path = `${CLIENTS_PATH}/${encodeURIComponent(id)}/${action}`;
    const trimmedReason = reason.trim();

    if (action === 'rotate') {
      if (!expiresAt) throw new Error('An expiry is required to rotate a credential.');

      const result = await this.auth.postAuthorized<CredentialDto>(path, {
        reason: trimmedReason,
        expires_at: expiresAt,
      });
      return { client: this.toClient(result.client), credential: result.credential };
    }

    const result = await this.auth.postAuthorized<ClientDto>(path, { reason: trimmedReason });
    return this.toClient(result);
  }

  private async readAllPages<T>(path: string): Promise<T[]> {
    const items: T[] = [];

    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ page: String(page), page_size: '100' });
      const result = await this.auth.getAuthorized<ApiPage<T>>(`${path}?${query.toString()}`);

      if (
        result.page !== page ||
        !Array.isArray(result.items) ||
        !Number.isSafeInteger(result.page_size) ||
        result.page_size < 1 ||
        !Number.isSafeInteger(result.total) ||
        result.total < 0
      ) {
        throw new Error('Unexpected integration API pagination.');
      }

      items.push(...result.items);
      if (!result.items.length || page * result.page_size >= result.total) return items;
    }
  }

  private toClient(client: ClientDto): IntegrationClient {
    return {
      id: client.id,
      organizationId: client.organization_id,
      organizationName:
        this.organizationNames.get(client.organization_id) ?? client.organization_id,
      name: client.name,
      status: client.status,
      scopes: client.scopes.includes(REPORTS_WRITE_SCOPE) ? [REPORTS_WRITE_SCOPE] : [],
      expiresAt: client.expires_at,
    };
  }
}
