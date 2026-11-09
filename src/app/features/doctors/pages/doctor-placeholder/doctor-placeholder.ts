import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-doctor-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `<section class="placeholder" aria-labelledby="page-title">
    <a routerLink="/workspace/doctor/dashboard">← Doctor dashboard</a>
    <h1 id="page-title">{{ title }}</h1>
    <p>{{ description }}</p>
    @if (patientId) {
      <p>Sample patient reference: {{ patientId }}</p>
    }
    @if (qr) {
      <img src="/doctor-qr-placeholder.svg" alt="Non-functional demonstration QR placeholder" />
      <p>Demo only. This is not a valid identity or access credential.</p>
    }
    <p>Preview only. This feature is not connected yet.</p>
  </section>`,
  styles: [
    `
      .placeholder {
        max-width: 760px;
        padding: 24px;
        border: 1px solid #e6eef5;
        border-radius: 12px;
        background: white;
        color: #17324d;
      }
      img {
        width: 144px;
        height: 144px;
      }
      a {
        color: #347da9;
      }
    `,
  ],
})
export class DoctorPlaceholder {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
  readonly patientId = this.route.snapshot.paramMap.get('id');
  readonly qr = this.route.snapshot.data['qr'] === true;
}
