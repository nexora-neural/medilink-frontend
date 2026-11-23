import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';

describe('dispensing route', () => {
  it('requires a session and pharmacist role before loading the workspace', () => {
    const workspace = routes.find((route) => route.path === 'workspace');
    const dispensing = workspace?.children?.find((route) => route.path === 'pharmacist/dispensing');
    expect(workspace?.canActivate).toContain(authGuard);
    expect(dispensing?.canActivate).toContain(roleGuard);
    expect(dispensing?.data?.['allowedRoles']).toEqual(['Pharmacist']);
    expect(dispensing?.loadComponent).toBeDefined();
  });
});
