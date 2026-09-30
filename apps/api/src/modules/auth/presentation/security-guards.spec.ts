import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CsrfGuard } from './csrf.guard';
import { PasswordReadyGuard } from './password-ready.guard';
import { ADMIN_ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('guards de segurança administrativa', () => {
  describe('CsrfGuard', () => {
    const guard = new CsrfGuard();

    it('aceita double-submit token idêntico', () => {
      const request = {
        cookies: { fad_admin_csrf: 'token-seguro' },
        header: (name: string) =>
          name === 'x-csrf-token' ? 'token-seguro' : undefined,
      };

      expect(guard.canActivate(contextFor(request))).toBe(true);
    });

    it('recusa token CSRF ausente', () => {
      const request = {
        cookies: {},
        header: () => undefined,
      };

      expect(() => guard.canActivate(contextFor(request))).toThrow(
        ForbiddenException,
      );
    });

    it('recusa token CSRF divergente', () => {
      const request = {
        cookies: { fad_admin_csrf: 'token-aaaa' },
        header: () => 'token-bbbb',
      };

      expect(() => guard.canActivate(contextFor(request))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('RolesGuard', () => {
    it('recusa papel não autorizado', () => {
      const getAllAndOverride = jest
        .fn()
        .mockReturnValue(['SUPER_ADMIN']);
      const guard = new RolesGuard({
        getAllAndOverride,
      } as never);

      const request = {
        admin: { role: 'ADMIN' },
      };

      expect(() => guard.canActivate(contextFor(request))).toThrow(
        ForbiddenException,
      );
    });

    it('aceita papel autorizado', () => {
      const getAllAndOverride = jest
        .fn()
        .mockReturnValue(['ADMIN', 'SUPER_ADMIN']);
      const guard = new RolesGuard({
        getAllAndOverride,
      } as never);

      const request = {
        admin: { role: 'ADMIN' },
      };

      expect(guard.canActivate(contextFor(request))).toBe(true);
    });

    it('restringe logout global ao SUPER_ADMIN', () => {
      expect(
        Reflect.getMetadata(
          ADMIN_ROLES_KEY,
          AuthController.prototype.logoutAll,
        ),
      ).toEqual(['SUPER_ADMIN']);
    });
  });

  describe('PasswordReadyGuard', () => {
    const guard = new PasswordReadyGuard();

    it('bloqueia administração antes da troca obrigatória de senha', () => {
      expect(() =>
        guard.canActivate(
          contextFor({
            admin: { mustChangePassword: true },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('libera administrador com senha pronta', () => {
      expect(
        guard.canActivate(
          contextFor({
            admin: { mustChangePassword: false },
          }),
        ),
      ).toBe(true);
    });
  });
});
