export type ClientStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';
export type ClientAction = 'suspend' | 'revoke' | 'rotate';

/** Credential/hash fields are deliberately absent from list and detail data. */
export interface IntegrationClient {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  status: ClientStatus;
  scopes: readonly [] | readonly ['reports:write'];
  expiresAt: string;
}

export interface ApprovedLab {
  id: string;
  name: string;
}

export interface ClientApproval {
  organizationId: string;
  name: string;
  scopes: readonly ['reports:write'];
  expiresAt: string;
}

export interface CredentialResult {
  client: IntegrationClient;
  credential: string;
}

/** Only operational metadata crosses this screen boundary; no patient/report body. */
export interface SubmissionOutcome {
  id: string;
  clientId: string;
  status: 'received' | 'processing' | 'accepted' | 'rejected' | 'failed';
  receivedAt: string;
  errorCode: string | null;
}

export function effectiveStatus(client: IntegrationClient, now = Date.now()): ClientStatus {
  if (client.status === 'revoked' || client.status === 'suspended') return client.status;
  const expiry = Date.parse(client.expiresAt);
  return !Number.isFinite(expiry) || expiry <= now ? 'expired' : client.status;
}

export function canAct(client: IntegrationClient, action: ClientAction): boolean {
  const status = effectiveStatus(client);
  return action === 'revoke' ? status !== 'revoked' : status === 'active';
}

export function outcomeExplanation(code: string | null): string {
  switch (code) {
    case 'DUPLICATE_REPORT':
      return 'Duplicate submission rejected.';
    case 'VALIDATION_ERROR':
      return 'Submission validation failed.';
    case 'ACCESS_DENIED':
      return 'Client access denied.';
    case 'INVALID_STATE':
      return 'The request is no longer available.';
    default:
      return code ? 'Submission could not be completed.' : 'No error reported.';
  }
}
