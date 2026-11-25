import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => {
  vi.resetModules();

  return {
    getApps: vi.fn(),
    initializeApp: vi.fn(),
    getAuth: vi.fn(),
    connectAuthEmulator: vi.fn(),
    setPersistence: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {},
  getAuth: firebaseMocks.getAuth,
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
  setPersistence: firebaseMocks.setPersistence,
  createUserWithEmailAndPassword: firebaseMocks.createUserWithEmailAndPassword,
  signInWithEmailAndPassword: firebaseMocks.signInWithEmailAndPassword,
  signOut: firebaseMocks.signOut,
}));

import { AuthService } from './auth.service';

describe('AuthService onboarding recovery', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const input = {
    email: 'patient@example.com',
    password: 'fictional-test-password',
    displayName: 'Demo Patient',
    phone: '0771234567',
    dateOfBirth: '2000-01-01',
    sex: 'female' as const,
  };

  const user = {
    getIdToken: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    firebaseMocks.getApps.mockReturnValue([{ name: 'medilink' }]);

    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: null,
    });

    firebaseMocks.setPersistence.mockResolvedValue(undefined);
    user.getIdToken.mockResolvedValue('mock-id-token');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    vi.stubGlobal('window', {
      medilinkConfig: {
        firebase: {
          apiKey: 'mock-api-key',
          projectId: 'mock-project',
        },
        apiBaseUrl: 'http://localhost:8000/api/v1',
      },
    });
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  async function expectOnboardingRequest() {
    await vi.waitFor(() => {
      expect(user.getIdToken).toHaveBeenCalled();
    });

    return http.expectOne('http://localhost:8000/api/v1/me/onboard');
  }

  it('creates a Firebase account and sends authenticated onboarding', async () => {
    firebaseMocks.createUserWithEmailAndPassword.mockResolvedValue({ user });

    const result = service.registerPatient(input);
    const request = await expectOnboardingRequest();

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    expect(request.request.body).toEqual({
      display_name: input.displayName,
      phone: input.phone,
      requested_role: 'patient',
      date_of_birth: input.dateOfBirth,
      sex: input.sex,
    });

    request.flush({});
    await result;

    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('rejects an existing Firebase email without signing in or onboarding', async () => {
    const failure = { code: 'auth/email-already-in-use' };
    firebaseMocks.createUserWithEmailAndPassword.mockRejectedValue(failure);
    await expect(service.registerPatient(input)).rejects.toEqual(failure);
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
    http.expectNone('http://localhost:8000/api/v1/me/onboard');
  });

  it('recovers an incomplete Firebase account with the existing password', async () => {
    firebaseMocks.signInWithEmailAndPassword.mockResolvedValue({ user });
    const result = service.registerPatient({ ...input, recoverExisting: true });
    const request = await expectOnboardingRequest();
    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      input.email,
      input.password,
    );
    request.flush({});
    await result;
  });

  it('keeps the Firebase session when backend onboarding fails', async () => {
    firebaseMocks.createUserWithEmailAndPassword.mockResolvedValue({ user });

    const result = service.registerPatient(input);

    // Attach the rejection check before returning the API failure.
    const rejection = expect(result).rejects.toMatchObject({
      status: 503,
    });

    const request = await expectOnboardingRequest();

    request.flush(
      { message: 'Service unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    await rejection;

    expect(firebaseMocks.signOut).not.toHaveBeenCalled();
  });

  it('sends authenticated organization API GET requests', async () => {
    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    });

    const result = service.getAuthorized<{ items: unknown[] }>('/admin/organizations');
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne('http://localhost:8000/api/v1/admin/organizations');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    request.flush({ items: [] });
    await expect(result).resolves.toEqual({ items: [] });
  });

  it('connects to the configured local Auth emulator before making authenticated requests', async () => {
    const auth = {
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    };
    firebaseMocks.getAuth.mockReturnValue(auth);
    vi.stubGlobal('window', {
      medilinkConfig: {
        firebase: { apiKey: 'demo-key', projectId: 'demo-medilink' },
        authEmulatorUrl: 'http://127.0.0.1:9099',
        apiBaseUrl: 'http://localhost:8000/api/v1',
      },
    });

    const result = service.getAuthorized<{ items: unknown[] }>('/admin/organizations');
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne('http://localhost:8000/api/v1/admin/organizations');
    expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    request.flush({ items: [] });
    await expect(result).resolves.toEqual({ items: [] });
  });

  it('sends authenticated organization decision POST requests', async () => {
    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    });

    const result = service.postAuthorized<{ status: string }>(
      'admin/organizations/org-1/decision',
      { status: 'active', reason: 'Verified' },
    );
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne(
      'http://localhost:8000/api/v1/admin/organizations/org-1/decision',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    expect(request.request.body).toEqual({ status: 'active', reason: 'Verified' });
    request.flush({ status: 'active' });
    await expect(result).resolves.toEqual({ status: 'active' });
  });

  it('sends authorized profile updates with PUT', async () => {
    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    });

    const body = { role: 'doctor', registration_number: 'D123' };
    const result = service.putAuthorized<{ verification_status: string }>(
      'me/professional-profile',
      body,
    );
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne('http://localhost:8000/api/v1/me/professional-profile');

    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    expect(request.request.body).toEqual(body);
    request.flush({ verification_status: 'not_submitted' });
    await expect(result).resolves.toEqual({ verification_status: 'not_submitted' });
  });

  it('sends document uploads as authenticated multipart form data', async () => {
    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    });

    const body = new FormData();
    body.append('document_type', 'verification_evidence');
    body.append('file', new Blob(['pdf']), 'evidence.pdf');
    const result = service.postAuthorizedForm<{ id: string }>('me/verification-documents', body);
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne('http://localhost:8000/api/v1/me/verification-documents');

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.body).toBe(body);
    request.flush({ id: 'doc-1' });
    await expect(result).resolves.toEqual({ id: 'doc-1' });
  });

  it('downloads authorized document content as a blob', async () => {
    firebaseMocks.getAuth.mockReturnValue({
      authStateReady: vi.fn().mockResolvedValue(undefined),
      currentUser: user,
    });

    const result = service.getAuthorizedBlob('documents/doc-1/content');
    await vi.waitFor(() => expect(user.getIdToken).toHaveBeenCalled());
    const request = http.expectOne('http://localhost:8000/api/v1/documents/doc-1/content');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-id-token');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['pdf'], { type: 'application/pdf' }));
    await expect(result).resolves.toBeInstanceOf(Blob);
  });
});
