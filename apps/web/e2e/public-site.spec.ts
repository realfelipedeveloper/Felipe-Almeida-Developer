import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const translations = {
  'pt-BR': {
    about: 'Sobre',
    projects: 'Projetos',
    articles: 'Artigos',
    news: 'Notícias',
    contact: 'Contato',
    newsletter: 'Newsletter',
    menu: 'Menu',
    lightTheme: 'Ativar tema claro',
    notFound: 'Conteúdo não encontrado.',
  },
  en: {
    about: 'About',
    projects: 'Projects',
    articles: 'Articles',
    news: 'News',
    contact: 'Contact',
    newsletter: 'Newsletter',
    menu: 'Menu',
    lightTheme: 'Enable light theme',
    notFound: 'Content not found.',
  },
  es: {
    about: 'Sobre mí',
    projects: 'Proyectos',
    articles: 'Artículos',
    news: 'Noticias',
    contact: 'Contacto',
    newsletter: 'Newsletter',
    menu: 'Menú',
    lightTheme: 'Activar tema claro',
    notFound: 'Contenido no encontrado.',
  },
} as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('fad-cookie-consent', 'essential');
  });
});

for (const [locale, labels] of Object.entries(translations)) {
  test(`navega pelas páginas principais em ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);

    const navigation = page.getByRole('navigation');
    for (const [label, path] of [
      [labels.about, 'sobre'],
      [labels.projects, 'projetos'],
      [labels.articles, 'artigos'],
      [labels.news, 'noticias'],
      [labels.contact, 'contato'],
      [labels.newsletter, 'newsletter'],
    ] as const) {
      await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'href',
        `/${locale}/${path}`,
      );
    }
  });

  test(`não apresenta violações automáticas de acessibilidade em ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`exibe 404 localizada em ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/pagina-inexistente`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(labels.notFound);
  });
}

test('persiste a preferência de tema após recarregar', async ({ page }) => {
  await page.goto('/pt-BR');
  await page.getByRole('button', { name: translations['pt-BR'].lightTheme }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fad-theme'))).toBe('light');

  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('abre a navegação completa em viewport mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pt-BR');
  await page.getByText(translations['pt-BR'].menu, { exact: true }).click();
  await expect(
    page.getByRole('link', { name: translations['pt-BR'].newsletter, exact: true }),
  ).toBeVisible();
});
