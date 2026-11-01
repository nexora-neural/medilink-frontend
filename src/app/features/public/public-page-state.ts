import { Directive } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

@Directive()
export abstract class PublicPageState {
  page = 'home';
  role = 'Patient';
  showPassword = false;
  submitted = false;
  busy = false;
  email = '';
  password = '';
  confirm = '';
  fullName = '';
  phone = '';
  professionalId = '';
  organization = '';
  code = '';
  accepted = false;
  message = '';
  documents: string[] = [];
  verification = 'Pending';
  notificationsEnabled = true;
  remindersEnabled = true;
  showEmpty = false;
  showError = false;
  saving = false;
  profileName = 'Nadeesha Perera';
  profileEmail = 'nadeesha@example.com';
  profilePhone = '+94 77 123 4567';
  profileDirty = false;
  contactName = '';
  contactEmail = '';
  contactSubject = '';
  contactMessage = '';
  contactSubmitted = false;
  contactSuccess = false;
  registerStep = 1;
  registerSubmitted = false;
  registerConfirm = '';
  get professionalRoles() {
    return this.roles.filter((r) => r.name !== 'Patient');
  }
  get registerSteps() {
    return this.role === 'Patient' ? 3 : 4;
  }
  registrationNext(form: any) {
    this.registerSubmitted = true;
    if (!form.valid) return;
    if (this.registerStep === this.registerSteps - 1 && this.password !== this.registerConfirm)
      return;
    if (this.registerStep < this.registerSteps) {
      this.registerStep++;
      this.registerSubmitted = false;
    } else {
      this.message = 'Registration is currently unavailable. No account has been created.';
    }
  }
  registrationBack() {
    if (this.registerStep > 1) {
      this.registerStep--;
      this.registerSubmitted = false;
    } else {
      this.router.navigate([this.role === 'Patient' ? '/' : '/professional-registration']);
    }
  }
  submitContact(form: any) {
    this.contactSubmitted = true;
    if (!form.valid) return;
    this.contactSuccess = true;
  }
  notices = [
    {
      title: 'Medication reminder',
      body: 'A dose is scheduled for this morning.',
      time: 'Today · 8:00 AM',
      icon: 'medication',
      read: false,
    },
    {
      title: 'Report added',
      body: 'A new report is available in your records.',
      time: 'Yesterday',
      icon: 'description',
      read: false,
    },
    {
      title: 'Access update',
      body: 'Review your shared access when you need to.',
      time: '25 October',
      icon: 'shield_person',
      read: true,
    },
  ];
  addDocument(event: Event) {
    const input = event.target as HTMLInputElement;
    this.documents = Array.from(input.files || []).map((f) => f.name);
  }
  saveProfile() {
    if (!this.profileName.trim() || !this.profileEmail.trim()) {
      this.message = 'Please provide your name and email.';
      return;
    }
    this.profileDirty = false;
    this.message = 'Changes cannot be saved at this time.';
  }
  saveSettings() {
    this.message = 'Preferences cannot be saved at this time.';
  }
  submitDocuments() {
    if (!this.documents.length) {
      this.message = 'Choose at least one document to continue.';
      return;
    }
    this.verification = 'Pending';
    this.router.navigate(['/verification-status'], { queryParams: { role: this.role } });
  }
  openPublic() {
    if (this.profileDirty && !window.confirm('You have unsaved changes. Leave without saving?'))
      return;
    this.router.navigate(['/']);
  }
  roles = [
    { name: 'Patient', icon: 'person', description: 'Manage your medicines and health records.' },
    {
      name: 'Doctor',
      icon: 'stethoscope',
      description: 'Review patient records and issue prescriptions.',
    },
    {
      name: 'Pharmacist',
      icon: 'medication',
      description: 'Review and record prescription dispensing.',
    },
    { name: 'Lab Staff', icon: 'science', description: 'Share laboratory reports with patients.' },
  ];
  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
  ) {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((d) => {
      this.page = d['page'] || 'home';
      this.submitted = false;
      this.registerStep = 1;
      this.registerSubmitted = false;
      this.message = '';
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    });
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.role = p['role'] && this.roles.some((r) => r.name === p['role']) ? p['role'] : 'Patient';
    });
  }
  submit(form: any) {
    this.submitted = true;
    if (!form.valid) return;
    if (this.page === 'reset' && this.password !== this.confirm) return;
    this.busy = true;
    setTimeout(() => {
      this.busy = false;
      if (this.page === 'register') {
        this.router.navigate(['/verify'], { queryParams: { role: this.role } });
      } else if (this.page === 'forgot') {
        this.message = 'Password reset is currently unavailable. No email has been sent.';
      } else if (this.page === 'reset') {
        this.message =
          'Password reset is currently unavailable. Your password has not been changed.';
      } else if (this.page === 'verify') {
        if (this.role !== 'Patient') {
          this.router.navigate(['/verification-documents'], { queryParams: { role: this.role } });
        } else {
          this.message = 'Contact verification is currently unavailable.';
        }
      } else {
        this.message = 'Sign-in is currently unavailable.';
      }
    }, 600);
  }
}
