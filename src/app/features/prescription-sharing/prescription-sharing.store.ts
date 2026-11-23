import { Injectable } from '@angular/core';
import {
  canShare,
  currentStatus,
  CreatedShare,
  PharmacyIdentity,
  PrescriptionShare,
  PrescriptionSharingPort,
  SharingData,
} from './prescription-sharing.models';
const MINUTE = 60_000;
export const DEMO_CODE = 'DEMO-CLAIM-132';
const identity: PharmacyIdentity = {
  pharmacistId: 'demo-pharmacist',
  name: 'A. Perera (sample)',
  registration: 'DEMO-PH-132',
  organizationId: 'demo-pharmacy',
  pharmacy: 'Sample Community Pharmacy',
  address: '12 Example Road, Colombo (sample)',
};
const iso = (n: number) => new Date(n).toISOString();
@Injectable()
export class PrescriptionSharingPreviewStore implements PrescriptionSharingPort {
  private shares: PrescriptionShare[] = [];
  private codes = new Map<string, string>();
  private sequence = 0;
  private initialized = false;
  private demoCodeExpiresAt = 0;
  private readonly prescriptions: SharingData['prescriptions'] = [
    {
      id: 'demo-doctor-order',
      label: 'Doctor-issued prescription · RX-DEMO-132',
      source: 'doctor',
      status: 'active',
    },
    {
      id: 'demo-patient-order',
      label: 'Patient-added prescription · Not clinically verified',
      source: 'patient',
      status: 'active',
    },
    { id: 'demo-draft', label: 'Doctor draft · Not issued', source: 'doctor', status: 'draft' },
  ];
  private seed(): void {
    if (this.initialized) return;
    this.initialized = true;
    const now = Date.now();
    const base = {
      prescriptionId: 'demo-doctor-order',
      prescriptionLabel: 'RX-DEMO-132',
      createdAt: iso(now - MINUTE),
      claimExpiresAt: iso(now + 14 * MINUTE),
    };
    this.shares = [
      { ...base, id: 'demo-pending', status: 'claimed', identity: { ...identity } },
      {
        ...base,
        id: 'demo-access',
        status: 'confirmed',
        identity: { ...identity },
        confirmedAt: iso(now - MINUTE),
        accessExpiresAt: iso(now + 1439 * MINUTE),
      },
      { ...base, id: 'demo-expired', status: 'expired', claimExpiresAt: iso(now - MINUTE) },
      { ...base, id: 'demo-revoked', status: 'revoked' },
    ];
    this.demoCodeExpiresAt = now + 15 * MINUTE;
    this.codes.set(DEMO_CODE, 'claimable-sample');
  }
  async load(): Promise<SharingData> {
    this.seed();
    return structuredClone({
      prescriptions: this.prescriptions,
      shares: this.shares,
      pharmacies: [
        { id: identity.organizationId, name: identity.pharmacy + ' (active sample membership)' },
      ],
    });
  }
  async create(prescriptionId: string): Promise<CreatedShare> {
    this.seed();
    if (!this.prescriptions.some((p) => p.id === prescriptionId && canShare(p)))
      throw new Error('ineligible');
    const now = Date.now();
    const share: PrescriptionShare = {
      id: 'demo-share-' + ++this.sequence,
      prescriptionId,
      prescriptionLabel: 'RX-DEMO-132',
      status: 'created',
      createdAt: iso(now),
      claimExpiresAt: iso(now + 15 * MINUTE),
    };
    const claimToken = 'DEMO-132-' + this.sequence;
    this.shares.unshift(share);
    this.codes.set(claimToken, share.id);
    return structuredClone({ share, claimToken });
  }
  async claim(token: string, organizationId: string): Promise<PrescriptionShare> {
    this.seed();
    if (organizationId !== identity.organizationId || !token.trim() || token.trim().length > 256)
      throw new Error('invalid');
    const id = this.codes.get(token.trim());
    if (!id) throw new Error('unavailable');
    let share = this.shares.find((s) => s.id === id);
    if (id === 'claimable-sample' && Date.now() >= this.demoCodeExpiresAt)
      throw new Error('expired');
    if (id === 'claimable-sample') {
      share = {
        id: 'demo-claim',
        prescriptionId: 'demo-doctor-order',
        prescriptionLabel: 'RX-DEMO-132',
        status: 'created',
        createdAt: iso(Date.now()),
        claimExpiresAt: iso(this.demoCodeExpiresAt),
      };
      this.shares.push(share);
    }
    if (!share || currentStatus(share, Date.now()) !== 'created') throw new Error('unavailable');
    // Consume before returning: a second claim in this preview cannot succeed.
    this.codes.delete(token.trim());
    share.status = 'claimed';
    share.identity = { ...identity };
    return structuredClone(share);
  }
  async confirm(id: string): Promise<PrescriptionShare> {
    const share = this.shares.find((s) => s.id === id);
    if (!share || currentStatus(share, Date.now()) !== 'claimed' || !share.identity)
      throw new Error('unavailable');
    share.status = 'confirmed';
    share.confirmedAt = iso(Date.now());
    share.accessExpiresAt = iso(Date.now() + 1440 * MINUTE);
    return structuredClone(share);
  }
  async revoke(id: string, reason: string): Promise<PrescriptionShare> {
    const share = this.shares.find((s) => s.id === id);
    if (
      !share ||
      !['created', 'claimed', 'confirmed'].includes(currentStatus(share, Date.now())) ||
      !reason.trim() ||
      reason.trim().length > 1000
    )
      throw new Error('unavailable');
    share.status = 'revoked';
    for (const [code, shareId] of this.codes) if (shareId === id) this.codes.delete(code);
    return structuredClone(share);
  }
  clearSession(): void {
    this.shares = [];
    this.codes.clear();
    this.sequence = 0;
    this.initialized = false;
  }
}
