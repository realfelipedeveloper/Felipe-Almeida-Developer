import 'reflect-metadata';

import {
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Readable } from 'node:stream';
import { AppLogger } from '../src/infra/logging/app-logger.service';
import type { AuthenticatedAdmin } from '../src/modules/auth/application/auth.types';
import { AdminAuthGuard } from '../src/modules/auth/presentation/admin-auth.guard';
import { CsrfGuard } from '../src/modules/auth/presentation/csrf.guard';
import { PasswordReadyGuard } from '../src/modules/auth/presentation/password-ready.guard';
import { RolesGuard } from '../src/modules/auth/presentation/roles.guard';
import {
  MEDIA_REPOSITORY,
  type MediaRepository,
} from '../src/modules/media/application/media.repository';
import { MEDIA_MALWARE_SCANNER } from '../src/modules/media/application/media-malware-scanner';
import { MEDIA_STORAGE, type MediaStorage } from '../src/modules/media/application/media-storage';
import { MediaService } from '../src/modules/media/application/media.service';
import { AdminMediaController } from '../src/modules/media/presentation/admin-media.controller';
import { MediaRateLimitGuard } from '../src/modules/media/presentation/media-rate-limit.guard';
import { PublicMediaController } from '../src/modules/media/presentation/public-media.controller';

const admin: AuthenticatedAdmin = {
  id: '74cd8ee1-a055-4f68-8910-c44870064bca',
  email: 'admin@example.com',
  role: 'ADMIN',
  sessionId: 'session',
  mustChangePassword: false,
};

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!['Bearer test', 'Bearer super'].includes(request.headers.authorization)) {
      throw new UnauthorizedException();
    }
    request.admin = {
      ...admin,
      role: request.headers.authorization === 'Bearer super' ? 'SUPER_ADMIN' : 'ADMIN',
    };
    return true;
  }
}

class TestCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-csrf-token'] !== 'test') throw new ForbiddenException();
    return true;
  }
}

describe('upload de mídia (e2e sem infraestrutura externa)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let setPublicVisible: (value: boolean) => void;

  beforeAll(async () => {
    let activeMedia: Awaited<ReturnType<MediaRepository['createPending']>> | null = null;
    let storedContent: Uint8Array = new Uint8Array();
    let publicVisible = false;
    setPublicVisible = (value) => {
      publicVisible = value;
    };
    const repository: MediaRepository = {
      createPending: async (input) => {
        activeMedia = {
          id: '55ed9830-d52d-47c4-8755-23522d940f53',
          ...input,
          createdAt: new Date('2026-10-10T12:00:00.000Z'),
          translations: [],
        };
        return activeMedia;
      },
      markStorageReady: async () => activeMedia!,
      markUploadFailed: async () => undefined,
      findActiveById: async () => activeMedia,
      findPublicById: async () => (publicVisible ? activeMedia : null),
      list: async () => ({ data: [], total: 0 }),
      replaceTranslations: async (_id, translations) => ({
        ...activeMedia!,
        translations,
      }),
      prepareDeletion: async () => ({ found: true, references: { total: 0 } }),
      markStorageDeleted: async () => undefined,
      listPendingStorageDeletions: async () => [],
    };
    const storage: MediaStorage = {
      provider: 'LOCAL',
      put: async (_key, content) => {
        storedContent = content;
      },
      open: async () => Readable.from(Buffer.from(storedContent)),
      delete: async () => undefined,
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMediaController, PublicMediaController],
      providers: [
        MediaService,
        RolesGuard,
        { provide: MEDIA_REPOSITORY, useValue: repository },
        { provide: MEDIA_STORAGE, useValue: storage },
        { provide: MEDIA_MALWARE_SCANNER, useValue: { scan: async () => undefined } },
        { provide: AppLogger, useValue: { child: () => ({ error: () => undefined }) } },
      ],
    })
      .overrideGuard(AdminAuthGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(CsrfGuard)
      .useClass(TestCsrfGuard)
      .overrideGuard(PasswordReadyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MediaRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Porta E2E indisponível.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function form(content: Blob, name: string): FormData {
    const body = new FormData();
    body.append('file', content, name);
    return body;
  }

  it('nega upload sem autenticação e sem CSRF', async () => {
    const file = new Blob(
      [
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      ],
      { type: 'image/png' },
    );
    const unauthenticated = await fetch(`${baseUrl}/api/admin/media`, {
      method: 'POST',
      body: form(file, 'image.png'),
    });
    expect(unauthenticated.status).toBe(401);

    const withoutCsrf = await fetch(`${baseUrl}/api/admin/media`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
      body: form(file, 'image.png'),
    });
    expect(withoutCsrf.status).toBe(403);
  });

  it('rejeita assinatura fora da allowlist', async () => {
    const response = await fetch(`${baseUrl}/api/admin/media`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'x-csrf-token': 'test' },
      body: form(new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' }), 'attack.svg'),
    });
    expect(response.status).toBe(400);
  });

  it('aceita PNG válido sem expor a chave de armazenamento', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const response = await fetch(`${baseUrl}/api/admin/media`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'x-csrf-token': 'test' },
      body: form(new Blob([png], { type: 'image/png' }), 'profile.png'),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      id: '55ed9830-d52d-47c4-8755-23522d940f53',
      kind: 'IMAGE',
      mimeType: 'image/png',
      originalName: 'profile.png',
    });
    expect(body).not.toHaveProperty('storageKey');
  });

  it('não expõe mídia órfã e transmite mídia pública com ETag', async () => {
    const id = '55ed9830-d52d-47c4-8755-23522d940f53';
    setPublicVisible(false);
    const hidden = await fetch(`${baseUrl}/api/media/${id}`);
    expect(hidden.status).toBe(404);

    setPublicVisible(true);
    const visible = await fetch(`${baseUrl}/api/media/${id}`);
    expect(visible.status).toBe(200);
    expect(visible.headers.get('cache-control')).toBe('public, max-age=300, must-revalidate');
    expect(visible.headers.get('x-content-type-options')).toBe('nosniff');
    const etag = visible.headers.get('etag');
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect((await visible.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const notModified = await fetch(`${baseUrl}/api/media/${id}`, {
      headers: { 'if-none-match': etag! },
    });
    expect(notModified.status).toBe(304);
  });

  it('protege edição e exclusão com autenticação, CSRF e papel elevado', async () => {
    const id = '55ed9830-d52d-47c4-8755-23522d940f53';
    const payload = {
      translations: [{ locale: 'pt-BR', title: 'Perfil', altText: 'Retrato' }],
    };
    const patchWithoutAuth = await fetch(`${baseUrl}/api/admin/media/${id}/translations`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(patchWithoutAuth.status).toBe(401);

    const deleteAsAdmin = await fetch(`${baseUrl}/api/admin/media/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test', 'x-csrf-token': 'test' },
    });
    expect(deleteAsAdmin.status).toBe(403);

    const deleteAsSuperAdmin = await fetch(`${baseUrl}/api/admin/media/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer super', 'x-csrf-token': 'test' },
    });
    expect(deleteAsSuperAdmin.status).toBe(204);
  });
});
