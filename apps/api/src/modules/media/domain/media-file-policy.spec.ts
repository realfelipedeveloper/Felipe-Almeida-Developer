import { PDFDocument } from 'pdf-lib';
import { MediaFilePolicyError, validateMediaFile } from './media-file-policy';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
function pdfDocument(catalogExtra = ''): Buffer {
  const header = '%PDF-1.7\n';
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R ${catalogExtra} >>\nendobj\n`,
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n',
  ];
  let body = header;
  const offsets = objects.map((object) => {
    const offset = Buffer.byteLength(body, 'latin1');
    body += object;
    return offset;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 4\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

const pdf = pdfDocument();

describe('validateMediaFile', () => {
  it('aceita imagem decodificável, remove metadados e gera metadados confiáveis', async () => {
    const result = await validateMediaFile({
      originalName: '..\\retratos/felipe final.PNG',
      claimedMimeType: 'image/png',
      buffer: png,
    });

    expect(result).toMatchObject({
      kind: 'IMAGE',
      mimeType: 'image/png',
      extension: 'png',
      safeOriginalName: 'felipe-final.png',
      width: 1,
      height: 1,
    });
    expect(result.byteSize).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('aceita PDF estruturalmente válido dentro do limite', async () => {
    const result = await validateMediaFile({
      originalName: 'currículo.pdf',
      claimedMimeType: 'application/pdf',
      buffer: pdf,
    });

    expect(result.kind).toBe('PDF');
    expect(result.safeOriginalName).toBe('curriculo.pdf');
  });

  it.each([
    [
      'assinatura desconhecida',
      Buffer.from('<svg onload=alert(1)>'),
      'image/svg+xml',
      'imagem.svg',
    ],
    ['MIME divergente', png, 'application/pdf', 'imagem.png'],
    ['extensão divergente', png, 'image/png', 'imagem.jpg'],
  ])('rejeita %s', async (_label, buffer, claimedMimeType, originalName) => {
    await expect(validateMediaFile({ originalName, claimedMimeType, buffer })).rejects.toThrow(
      MediaFilePolicyError,
    );
  });

  it('rejeita arquivo acima do limite da categoria', async () => {
    await expect(
      validateMediaFile(
        { originalName: 'imagem.png', claimedMimeType: 'image/png', buffer: png },
        { imageMaxBytes: png.length - 1, pdfMaxBytes: 1024 },
      ),
    ).rejects.toThrow('limite');
  });

  it('rejeita nome vazio ou com byte nulo', async () => {
    await expect(
      validateMediaFile({ originalName: '\u0000.png', claimedMimeType: 'image/png', buffer: png }),
    ).rejects.toThrow(MediaFilePolicyError);
  });

  it('rejeita PNG truncado e PDF com conteúdo ativo', async () => {
    await expect(
      validateMediaFile({
        originalName: 'bad.png',
        claimedMimeType: 'image/png',
        buffer: png.subarray(0, 24),
      }),
    ).rejects.toThrow('decodificada');

    const activePdf = pdfDocument('/OpenAction << /S /JavaScript /JS (alert) >>');
    await expect(
      validateMediaFile({
        originalName: 'active.pdf',
        claimedMimeType: 'application/pdf',
        buffer: activePdf,
      }),
    ).rejects.toThrow('conteúdo ativo');
  });

  it('rejeita um pseudo-PDF sem catálogo, páginas, xref e trailer válidos', async () => {
    const malformed = Buffer.from('%PDF-1.4\nstartxref\n0\n%%EOF');

    await expect(
      validateMediaFile({
        originalName: 'malformed.pdf',
        claimedMimeType: 'application/pdf',
        buffer: malformed,
      }),
    ).rejects.toThrow('interpretado');
  });

  it('rejeita JavaScript oculto em object stream comprimido', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.addJavaScript('startup', 'app.alert("x")');
    const compressed = Buffer.from(await document.save({ useObjectStreams: true }));

    await expect(
      validateMediaFile({
        originalName: 'compressed-action.pdf',
        claimedMimeType: 'application/pdf',
        buffer: compressed,
      }),
    ).rejects.toThrow('conteúdo ativo');
  });
});
