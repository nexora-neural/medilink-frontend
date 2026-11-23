import { currentStatus } from './prescription-sharing.models';
import { DEMO_CODE, PrescriptionSharingPreviewStore } from './prescription-sharing.store';

describe('prescription sharing preview lifecycle', () => {
  let store: PrescriptionSharingPreviewStore;
  beforeEach(() => {
    store = new PrescriptionSharingPreviewStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T08:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  it('lists only synthetic metadata with no claim token or medicine content', async () => {
    const data = await store.load();
    expect(data.shares.map((s) => s.status)).toEqual([
      'claimed',
      'confirmed',
      'expired',
      'revoked',
    ]);
    expect(JSON.stringify(data)).not.toMatch(/claimToken|DEMO-CLAIM|medicine|patientName/);
  });
  it.each(['demo-patient-order', 'demo-draft', 'unknown'])(
    'rejects ineligible prescription %s',
    async (id) => {
      await expect(store.create(id)).rejects.toThrow();
    },
  );
  it('creates a 15-minute code without starting pharmacy access', async () => {
    const result = await store.create('demo-doctor-order');
    expect(result.claimToken).toMatch(/^DEMO-/);
    expect(Date.parse(result.share.claimExpiresAt) - Date.now()).toBe(15 * 60_000);
    expect(result.share.status).toBe('created');
    expect(result.share.accessExpiresAt).toBeUndefined();
    expect(JSON.stringify(await store.load())).not.toContain(result.claimToken);
  });
  it('does not allow confirming an unclaimed share', async () => {
    const { share } = await store.create('demo-doctor-order');
    await expect(store.confirm(share.id)).rejects.toThrow();
  });
  it('claims once and returns identity without medicines', async () => {
    const claim = await store.claim(DEMO_CODE, 'demo-pharmacy');
    expect(claim.status).toBe('claimed');
    expect(claim.identity?.organizationId).toBe('demo-pharmacy');
    expect(claim.accessExpiresAt).toBeUndefined();
    await expect(store.claim(DEMO_CODE, 'demo-pharmacy')).rejects.toThrow();
  });
  it('permits only one of two concurrent claims', async () => {
    const results = await Promise.allSettled([
      store.claim(DEMO_CODE, 'demo-pharmacy'),
      store.claim(DEMO_CODE, 'demo-pharmacy'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it.each(['', 'wrong-pharmacy'])(
    'rejects pharmacy membership %s without consuming code',
    async (org) => {
      await expect(store.claim(DEMO_CODE, org)).rejects.toThrow();
      expect((await store.claim(DEMO_CODE, 'demo-pharmacy')).status).toBe('claimed');
    },
  );
  it.each(['', 'bad-code', 'x'.repeat(257)])(
    'rejects invalid/unknown/oversized code',
    async (token) => {
      await expect(store.claim(token, 'demo-pharmacy')).rejects.toThrow();
    },
  );
  it('expires a code at exactly 15 minutes', async () => {
    const result = await store.create('demo-doctor-order');
    vi.advanceTimersByTime(15 * 60_000);
    expect(currentStatus(result.share, Date.now())).toBe('expired');
    await expect(store.claim(result.claimToken, 'demo-pharmacy')).rejects.toThrow();
  });
  it('rejects confirmation if the claim deadline passed', async () => {
    await store.load();
    vi.advanceTimersByTime(14 * 60_000);
    await expect(store.confirm('demo-pending')).rejects.toThrow();
  });
  it('starts a 24-hour grant at confirmation and cannot extend it by confirming again', async () => {
    const claim = await store.claim(DEMO_CODE, 'demo-pharmacy');
    vi.advanceTimersByTime(2 * 60_000);
    const confirmed = await store.confirm(claim.id);
    expect(Date.parse(confirmed.confirmedAt!)).toBe(Date.now());
    expect(Date.parse(confirmed.accessExpiresAt!) - Date.now()).toBe(24 * 60 * 60_000);
    await expect(store.confirm(claim.id)).rejects.toThrow();
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(currentStatus(confirmed, Date.now())).toBe('expired');
    await expect(store.revoke(claim.id, 'expired')).rejects.toThrow();
  });
  it.each(['', '  ', 'x'.repeat(1001)])('rejects invalid revoke reason', async (reason) => {
    await store.load();
    await expect(store.revoke('demo-pending', reason)).rejects.toThrow();
  });
  it('revokes a created code before it can be claimed', async () => {
    const result = await store.create('demo-doctor-order');
    expect((await store.revoke(result.share.id, 'Wrong recipient')).status).toBe('revoked');
    await expect(store.claim(result.claimToken, 'demo-pharmacy')).rejects.toThrow();
  });
  it.each(['demo-pending', 'demo-access'])('revokes pending or live share %s', async (id) => {
    await store.load();
    const share = await store.revoke(id, 'No longer required');
    expect(currentStatus(share, Date.now())).toBe('revoked');
    await expect(store.confirm(id)).rejects.toThrow();
    await expect(store.revoke(id, 'Again')).rejects.toThrow();
  });
  it('returns detached snapshots and preserves mutations on reload', async () => {
    const data = await store.load();
    data.shares[0].status = 'revoked';
    expect((await store.load()).shares[0].status).toBe('claimed');
    await store.confirm('demo-pending');
    expect((await store.load()).shares[0].status).toBe('confirmed');
  });
  it('clears codes and mutations between sessions', async () => {
    const result = await store.create('demo-doctor-order');
    store.clearSession();
    expect((await store.load()).shares.some((s) => s.id === result.share.id)).toBe(false);
    await expect(store.claim(result.claimToken, 'demo-pharmacy')).rejects.toThrow();
  });
  it('fails closed for a missing or invalid expiry', async () => {
    const share = (await store.load()).shares[1];
    expect(currentStatus({ ...share, accessExpiresAt: undefined }, Date.now())).toBe('expired');
    expect(currentStatus({ ...share, accessExpiresAt: 'invalid' }, Date.now())).toBe('expired');
  });
  it('expires the pharmacist sample code after 15 minutes too', async () => {
    await store.load();
    vi.advanceTimersByTime(15 * 60_000);
    await expect(store.claim(DEMO_CODE, 'demo-pharmacy')).rejects.toThrow();
  });
  it('does not extend the original claim deadline when a code is claimed', async () => {
    await store.load();
    vi.advanceTimersByTime(10 * 60_000);
    const share = await store.claim(DEMO_CODE, 'demo-pharmacy');
    expect(Date.parse(share.claimExpiresAt) - Date.now()).toBe(5 * 60_000);
    vi.advanceTimersByTime(5 * 60_000);
    await expect(store.confirm(share.id)).rejects.toThrow();
  });
});
