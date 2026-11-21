import { Injectable, InjectionToken } from '@angular/core';
import {
  ApprovedLab,
  canAct,
  ClientAction,
  ClientApproval,
  CredentialResult,
  IntegrationClient,
  SubmissionOutcome,
} from './integration-clients.models';

/** Operations used by the integration client and submission screens. */
export interface IntegrationClientsPort {
  listClients(): Promise<IntegrationClient[]>;
  listApprovedLabs(): Promise<ApprovedLab[]>;
  listSubmissions(): Promise<SubmissionOutcome[]>;
  approve(input: ClientApproval): Promise<CredentialResult>;
  change(
    id: string,
    action: ClientAction,
    reason: string,
    expiresAt?: string,
  ): Promise<CredentialResult | IntegrationClient>;
}

export const INTEGRATION_CLIENTS = new InjectionToken<IntegrationClientsPort>(
  'IntegrationClientsPort',
);

@Injectable()
export class IntegrationClientsPreviewStore implements IntegrationClientsPort {
  // Synthetic, memory-only fixtures. Never persist or generate usable API credentials here.
  private readonly labs: ApprovedLab[] = [
    { id: 'sample-lab', name: 'Central Laboratory (sample)' },
  ];
  private clients: IntegrationClient[] = [
    {
      id: 'sample-active',
      organizationId: 'sample-lab',
      organizationName: 'Central Laboratory (sample)',
      name: 'Report uploader',
      status: 'active',
      scopes: ['reports:write'],
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    {
      id: 'sample-suspended',
      organizationId: 'sample-lab',
      organizationName: 'Central Laboratory (sample)',
      name: 'Suspended connector',
      status: 'suspended',
      scopes: ['reports:write'],
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    {
      id: 'sample-revoked',
      organizationId: 'sample-lab',
      organizationName: 'Central Laboratory (sample)',
      name: 'Retired connector',
      status: 'revoked',
      scopes: ['reports:write'],
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  ];
  private sequence = 0;

  async listClients(): Promise<IntegrationClient[]> {
    return structuredClone(this.clients);
  }
  async listApprovedLabs(): Promise<ApprovedLab[]> {
    return structuredClone(this.labs);
  }
  async listSubmissions(): Promise<SubmissionOutcome[]> {
    return [
      {
        id: 'sample-submission-001',
        clientId: 'sample-active',
        status: 'accepted',
        receivedAt: new Date().toISOString(),
        errorCode: null,
      },
      {
        id: 'sample-submission-002',
        clientId: 'sample-active',
        status: 'rejected',
        receivedAt: new Date().toISOString(),
        errorCode: 'DUPLICATE_REPORT',
      },
    ];
  }

  async approve(input: ClientApproval): Promise<CredentialResult> {
    const lab = this.labs.find((item) => item.id === input.organizationId);
    if (
      !lab ||
      !input.name.trim() ||
      input.name.trim().length > 200 ||
      input.scopes.length !== 1 ||
      input.scopes[0] !== 'reports:write' ||
      !this.validExpiry(input.expiresAt)
    )
      throw new Error('Invalid sample approval');
    const client: IntegrationClient = {
      id: `sample-client-${++this.sequence}`,
      organizationId: lab.id,
      organizationName: lab.name,
      name: input.name.trim(),
      scopes: ['reports:write'],
      status: 'active',
      expiresAt: input.expiresAt,
    };
    this.clients = [...this.clients, client];
    return { client: structuredClone(client), credential: 'DEMO-ONLY-NOT-A-VALID-API-KEY' };
  }

  async change(
    id: string,
    action: ClientAction,
    reason: string,
    expiresAt?: string,
  ): Promise<CredentialResult | IntegrationClient> {
    const current = this.clients.find((item) => item.id === id);
    if (
      !current ||
      !canAct(current, action) ||
      !reason.trim() ||
      reason.length > 1000 ||
      (action === 'rotate' && !this.validExpiry(expiresAt))
    )
      throw new Error('Invalid sample action');
    const client: IntegrationClient = {
      ...current,
      status: action === 'revoke' ? 'revoked' : action === 'suspend' ? 'suspended' : 'active',
      expiresAt: action === 'rotate' ? expiresAt! : current.expiresAt,
    };
    this.clients = this.clients.map((item) => (item.id === id ? client : item));
    return action === 'rotate'
      ? { client: structuredClone(client), credential: 'DEMO-ONLY-ROTATED-NOT-A-VALID-API-KEY' }
      : structuredClone(client);
  }

  private validExpiry(value?: string): boolean {
    return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now();
  }
}
