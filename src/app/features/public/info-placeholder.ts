import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  selector: 'app-info-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `<main class="public-detail wrap">
    <section class="public-detail-hero">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <a routerLink="/contact">Contact and support information</a>
    </section>
  </main>`,
})
export class InfoPlaceholder {
  title: string;
  description: string;
  constructor(route: ActivatedRoute) {
    this.title = route.snapshot.data['title'];
    this.description = route.snapshot.data['description'];
  }
}
