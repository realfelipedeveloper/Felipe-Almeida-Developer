import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_RICH_TEXT_CHARACTERS } from '../../../../shared/application/rich-text-sanitizer';
import {
  ArticleTranslationAdminDto,
  NewsTranslationAdminDto,
  UpdateProfileAdminDto,
} from './admin-content.dto';

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

  it('aceita todo o conteúdo editável da página Sobre', async () => {
    const translations = ['pt-BR', 'en', 'es'].map((locale) => ({
      locale,
      fullName: 'Felipe Almeida',
      headline: 'Engenheiro de Software',
      summary: 'Resumo',
      bio: 'Biografia',
      aboutEyebrow: 'Sobre',
      aboutTitle: 'Engenharia além da implementação',
      aboutIntro: 'Introdução',
      aboutPrinciplesTitle: 'Como eu trabalho',
      aboutGalleryTitle: 'Além do código',
      aboutGalleryText: 'Registros pessoais',
      aboutResumeLabel: 'Baixar currículo',
    }));
    const principleTranslations = ['pt-BR', 'en', 'es'].map((locale) => ({
      locale,
      title: 'Arquitetura com propósito',
      text: 'Complexidade precisa ser justificada.',
    }));
    const instance = plainToInstance(UpdateProfileAdminDto, {
      availableForWork: true,
      translations,
      socialLinks: [],
      principles: [{ sortOrder: 0, translations: principleTranslations }],
      galleryMediaIds: ['55ed9830-d52d-47c4-8755-23522d940f53'],
    });

    await expect(validate(instance)).resolves.toHaveLength(0);
  });

  it('rejeita mídias duplicadas na galeria da página Sobre', async () => {
    const mediaId = '55ed9830-d52d-47c4-8755-23522d940f53';
    const instance = plainToInstance(UpdateProfileAdminDto, {
      translations: [],
      socialLinks: [],
      principles: [],
      galleryMediaIds: [mediaId, mediaId],
    });

    const errors = await validate(instance);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'galleryMediaIds' })]),
    );
  });
});
