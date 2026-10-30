import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './status-page.html',
  styleUrl: './status-page.scss',
})
export class StatusPage {
  private readonly route = inject(ActivatedRoute);
  readonly code = this.route.snapshot.data['code'] as '403' | '404';
  readonly isForbidden = this.code === '403';
  readonly title = this.isForbidden ? 'Access denied' : 'Page not found';
  readonly description = this.isForbidden
    ? 'Your active role does not have permission to open this workspace area.'
    : 'The page you are looking for is not available at this address.';
}
