import { Component, inject } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-header.html',
  styleUrl: './public-header.scss',
})
export class PublicHeader {
  menuOpen = false;
  profileOpen = false;
  preview = false;

  private readonly router = inject(Router);

  constructor() {
    this.preview = this.router.url.split('?')[0] === '/header-preview';
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.preview = this.router.url.split('?')[0] === '/header-preview';
        this.profileOpen = false;
      });
  }
}
