import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {},
  getAuth: firebaseMocks.getAuth,
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

  it('recovers an existing Firebase account using its password', async () => {
    firebaseMocks.createUserWithEmailAndPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });

    firebaseMocks.signInWithEmailAndPassword.mockResolvedValue({ user });

    const result = service.registerPatient(input);
    const request = await expectOnboardingRequest();

    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      input.email,
      input.password,
    );

    request.flush({});
    await result;
  });

  it('does not onboard when the existing account password is wrong', async () => {
    firebaseMocks.createUserWithEmailAndPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });

    const failure = {
      code: 'auth/invalid-credential',
    };

    firebaseMocks.signInWithEmailAndPassword.mockRejectedValue(failure);

    await expect(service.registerPatient(input)).rejects.toEqual(failure);

    http.expectNone('http://localhost:8000/api/v1/me/onboard');
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
});
