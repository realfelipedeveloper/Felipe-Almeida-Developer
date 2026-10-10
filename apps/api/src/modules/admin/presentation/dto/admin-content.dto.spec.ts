import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_RICH_TEXT_CHARACTERS } from '../../../../shared/application/rich-text-sanitizer';
import { ArticleTranslationAdminDto, NewsTranslationAdminDto } from './admin-content.dto';

const baseTranslation = {
  locale: 'pt-BR',
  title: 'Título',
  slug: 'titulo',
  summary: 'Resumo',
};

describe('DTOs de conteúdo administrativo', () => {
  it.each([
    [ArticleTranslationAdminDto, 'bodyHtml'],
    [NewsTranslationAdminDto, 'contentHtml'],
  ] as const)('rejeita HTML rico acima de 200 mil caracteres em %s', async (Dto, field) => {
    const DtoClass = Dto as new () => object;
    const instance = plainToInstance(DtoClass, {
      ...baseTranslation,
      [field]: 'x'.repeat(MAX_RICH_TEXT_CHARACTERS + 1),
    });

    const errors = await validate(instance);

    expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ property: field })]));
  });
});
