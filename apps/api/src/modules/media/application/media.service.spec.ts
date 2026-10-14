import { ConflictException } from '@nestjs/common';
import type { AppLogger } from '../../../infra/logging/app-logger.service';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type { MediaRepository } from './media.repository';
import type { MediaStorage } from './media-storage';
import { MediaService } from './media.service';

const admin: AuthenticatedAdmin = {
  id: '74cd8ee1-a055-4f68-8910-c44870064bca',
  email: 'admin@example.com',
  role: 'ADMIN',
  sessionId: 'session',
  mustChangePassword: false,
};

const file = {
  originalName: 'foto.png',
  claimedMimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
};

function setup() {
  const repository = {
    createPending: jest.fn(),
    markStorageReady: jest.fn(),
    markUploadFailed: jest.fn().mockResolvedValue(undefined),
    findActiveById: jest.fn(),
    findPublicById: jest.fn(),
    list: jest.fn(),
    replaceTranslations: jest.fn(),
    prepareDeletion: jest.fn(),
    markStorageDeleted: jest.fn().mockResolvedValue(undefined),
    listPendingStorageDeletions: jest.fn().mockResolvedValue([]),
  } as jest.Mocked<MediaRepository>;
  repository.createPending.mockResolvedValue(mediaRecord());
  repository.markStorageReady.mockResolvedValue(mediaRecord());
  const storage = {
    provider: 'LOCAL' as const,
    put: jest.fn().mockResolvedValue(undefined),
    open: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<MediaStorage>;
  const malwareScanner = { scan: jest.fn().mockResolvedValue(undefined) };
  const logger = {
    child: jest.fn().mockReturnValue({ error: jest.fn() }),
  } as unknown as AppLogger;
  return {
    repository,
    storage,
    service: new MediaService(repository, storage, malwareScanner, logger),
  };
}

function mediaRecord() {
  return {
    id: '55ed9830-d52d-47c4-8755-23522d940f53',
    kind: 'IMAGE' as const,
    storageProvider: 'LOCAL' as const,
    storageKey: 'image/2026/10/55ed9830-d52d-47c4-8755-23522d940f53.png',
    originalName: 'foto.png',
    mimeType: 'image/png',
    extension: 'png',
    byteSize: 12n,
    sha256: 'a'.repeat(64),
    width: 1,
    height: 1,
    createdAt: new Date(),
    translations: [],
  };
}

describe('MediaService', () => {
  it('não grava no storage quando o manifesto pendente falha', async () => {
    const { repository, storage, service } = setup();
    repository.createPending.mockRejectedValue(new Error('database unavailable'));

    await expect(service.upload(file, admin)).rejects.toThrow('database unavailable');
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('mantém manifesto durável quando as três tentativas de cleanup falham', async () => {
    const { repository, storage, service } = setup();
    repository.markStorageReady.mockRejectedValue(new Error('database unavailable'));
    storage.delete.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.upload(file, admin)).rejects.toThrow('database unavailable');

    expect(repository.markUploadFailed).toHaveBeenCalledWith(mediaRecord().id);
    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(repository.markStorageDeleted).not.toHaveBeenCalled();
  });

  it('bloqueia exclusão quando a mídia ainda está referenciada', async () => {
    const { repository, storage, service } = setup();
    repository.findActiveById.mockResolvedValue(mediaRecord());
    repository.prepareDeletion.mockResolvedValue({
      found: true,
      references: { profileAvatars: 1, total: 1 },
    });

    await expect(
      service.delete('55ed9830-d52d-47c4-8755-23522d940f53', admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('mantém o tombstone se a remoção física tiver resposta ambígua', async () => {
    const { repository, storage, service } = setup();
    repository.findActiveById.mockResolvedValue(mediaRecord());
    repository.prepareDeletion.mockResolvedValue({ found: true, references: { total: 0 } });
    storage.delete.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.delete('55ed9830-d52d-47c4-8755-23522d940f53', admin)).rejects.toThrow(
      'reconciliação',
    );
    expect(repository.prepareDeletion).toHaveBeenCalled();
  });

  it('não publica mídia órfã ou ligada somente a rascunho', async () => {
    const { repository, service } = setup();
    repository.findPublicById.mockResolvedValue(null);

    await expect(service.getPublicMedia('55ed9830-d52d-47c4-8755-23522d940f53')).rejects.toThrow(
      'não encontrada',
    );
  });

  it('confirma a limpeza física depois de excluir o objeto', async () => {
    const { repository, service } = setup();
    repository.findActiveById.mockResolvedValue(mediaRecord());
    repository.prepareDeletion.mockResolvedValue({ found: true, references: { total: 0 } });

    await service.delete('55ed9830-d52d-47c4-8755-23522d940f53', admin);

    expect(repository.markStorageDeleted).toHaveBeenCalledWith(
      '55ed9830-d52d-47c4-8755-23522d940f53',
    );
  });

  it('reconcilia de forma idempotente limpezas físicas pendentes', async () => {
    const { repository, storage, service } = setup();
    repository.listPendingStorageDeletions.mockResolvedValue([
      {
        id: '55ed9830-d52d-47c4-8755-23522d940f53',
        storageProvider: 'LOCAL',
        storageKey: mediaRecord().storageKey,
      },
    ]);

    await expect(service.reconcilePendingStorageDeletions()).resolves.toEqual({
      inspected: 1,
      reconciled: 1,
      failed: 0,
    });
    expect(storage.delete).toHaveBeenCalledWith(mediaRecord().storageKey);
    expect(repository.markStorageDeleted).toHaveBeenCalledTimes(1);
  });
});
