import { NotFoundException } from '@nestjs/common';
import type { NewsPublicReadRepository } from './news-public.types';
import { NewsPublicService } from './news-public.service';

describe('NewsPublicService', () => {
  it('não armazena listagem temporal em cache Redis', async () => {
    const repository = {
      listPublished: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findPublishedBySlug: jest.fn(),
    } as jest.Mocked<NewsPublicReadRepository>;
    const service = new NewsPublicService(repository);

    await expect(service.list({ locale: 'pt-BR', page: 1, limit: 12 })).resolves.toMatchObject({
      data: [],
      pagination: { total: 0 },
    });
    expect(repository.listPublished).toHaveBeenCalledTimes(1);
  });

  it('consulta o detalhe diretamente para não servir cache fora da janela temporal', async () => {
    const repository = {
      listPublished: jest.fn(),
      findPublishedBySlug: jest.fn().mockResolvedValue(null),
    } as jest.Mocked<NewsPublicReadRepository>;
    const service = new NewsPublicService(repository);

    await expect(service.findBySlug('pt-BR', 'agendada')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findPublishedBySlug).toHaveBeenCalledWith('pt-BR', 'agendada');
  });
});
