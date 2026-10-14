import { createHash } from 'node:crypto';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';
import sharp from 'sharp';

export const DEFAULT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const ABSOLUTE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const DEFAULT_IMAGE_MAX_PIXELS = 40_000_000;

export type MediaKindValue = 'IMAGE' | 'PDF';

export interface MediaUploadCandidate {
  originalName: string;
  claimedMimeType: string;
  buffer: Buffer;
}

export interface MediaFileLimits {
  imageMaxBytes: number;
  pdfMaxBytes: number;
}

export interface ValidatedMediaFile {
  kind: MediaKindValue;
  mimeType: string;
  extension: 'jpg' | 'png' | 'webp' | 'gif' | 'pdf';
  safeOriginalName: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  content: Buffer;
}

interface DetectedFile {
  kind: MediaKindValue;
  mimeType: string;
  extension: ValidatedMediaFile['extension'];
  acceptedExtensions: string[];
}

export class MediaFilePolicyError extends Error {}

const signatures: Array<{ matches: (buffer: Buffer) => boolean; file: DetectedFile }> = [
  {
    matches: (buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer.at(-2) === 0xff &&
      buffer.at(-1) === 0xd9,
    file: {
      kind: 'IMAGE',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      acceptedExtensions: ['jpg', 'jpeg'],
    },
  },
  {
    matches: (buffer) =>
      buffer.length >= 24 &&
      buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      buffer.subarray(12, 16).toString('ascii') === 'IHDR',
    file: {
      kind: 'IMAGE',
      mimeType: 'image/png',
      extension: 'png',
      acceptedExtensions: ['png'],
    },
  },
  {
    matches: (buffer) =>
      buffer.length >= 16 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
    file: {
      kind: 'IMAGE',
      mimeType: 'image/webp',
      extension: 'webp',
      acceptedExtensions: ['webp'],
    },
  },
  {
    matches: (buffer) => {
      const header = buffer.subarray(0, 6).toString('ascii');
      return buffer.length >= 10 && (header === 'GIF87a' || header === 'GIF89a');
    },
    file: {
      kind: 'IMAGE',
      mimeType: 'image/gif',
      extension: 'gif',
      acceptedExtensions: ['gif'],
    },
  },
  {
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-' &&
      /%%EOF\s*$/.test(buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1')),
    file: {
      kind: 'PDF',
      mimeType: 'application/pdf',
      extension: 'pdf',
      acceptedExtensions: ['pdf'],
    },
  },
];

export function mediaFileLimitsFromEnvironment(): MediaFileLimits {
  return {
    imageMaxBytes: boundedLimit(process.env.MEDIA_MAX_IMAGE_BYTES, DEFAULT_IMAGE_MAX_BYTES),
    pdfMaxBytes: boundedLimit(process.env.MEDIA_MAX_PDF_BYTES, DEFAULT_PDF_MAX_BYTES),
  };
}

export async function validateMediaFile(
  candidate: MediaUploadCandidate,
  limits: MediaFileLimits = {
    imageMaxBytes: DEFAULT_IMAGE_MAX_BYTES,
    pdfMaxBytes: DEFAULT_PDF_MAX_BYTES,
  },
): Promise<ValidatedMediaFile> {
  if (!Buffer.isBuffer(candidate.buffer) || candidate.buffer.length === 0) {
    throw new MediaFilePolicyError('O arquivo enviado está vazio.');
  }
  if (!candidate.originalName || candidate.originalName.includes('\0')) {
    throw new MediaFilePolicyError('O nome do arquivo é inválido.');
  }

  const detected = signatures.find(({ matches }) => matches(candidate.buffer))?.file;
  if (!detected) {
    throw new MediaFilePolicyError('Tipo de arquivo não permitido ou assinatura inválida.');
  }

  if (candidate.claimedMimeType.trim().toLowerCase() !== detected.mimeType) {
    throw new MediaFilePolicyError('O MIME informado não corresponde ao conteúdo do arquivo.');
  }

  const originalBase = candidate.originalName.split(/[\\/]/).pop() ?? '';
  const suppliedExtension = originalBase.includes('.')
    ? (originalBase.split('.').pop() ?? '').toLowerCase()
    : '';
  if (!detected.acceptedExtensions.includes(suppliedExtension)) {
    throw new MediaFilePolicyError('A extensão não corresponde ao conteúdo do arquivo.');
  }

  const limit = detected.kind === 'IMAGE' ? limits.imageMaxBytes : limits.pdfMaxBytes;
  if (candidate.buffer.length > limit) {
    throw new MediaFilePolicyError(`O arquivo excede o limite de ${limit} bytes.`);
  }

  const normalized =
    detected.kind === 'IMAGE'
      ? await normalizeImage(candidate.buffer, detected.extension)
      : await validatePdf(candidate.buffer);
  if (normalized.content.length > limit) {
    throw new MediaFilePolicyError(`O arquivo processado excede o limite de ${limit} bytes.`);
  }

  return {
    kind: detected.kind,
    mimeType: detected.mimeType,
    extension: detected.extension,
    safeOriginalName: safeOriginalName(originalBase, detected.extension),
    byteSize: normalized.content.length,
    sha256: createHash('sha256').update(normalized.content).digest('hex'),
    width: normalized.width,
    height: normalized.height,
    content: normalized.content,
  };
}

async function normalizeImage(
  content: Buffer,
  extension: ValidatedMediaFile['extension'],
): Promise<{ content: Buffer; width: number; height: number }> {
  const limitInputPixels = boundedLimit(
    process.env.MEDIA_MAX_IMAGE_PIXELS,
    DEFAULT_IMAGE_MAX_PIXELS,
    100_000_000,
  );
  try {
    const input = sharp(content, { limitInputPixels, animated: true });
    const metadata = await input.metadata();
    const expectedFormat = extension === 'jpg' ? 'jpeg' : extension;
    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new MediaFilePolicyError('A imagem está corrompida, animada ou fora da política.');
    }

    const pipeline = sharp(content, { limitInputPixels }).rotate();
    const output =
      extension === 'jpg'
        ? await pipeline.jpeg({ quality: 90, progressive: true }).toBuffer()
        : extension === 'png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : extension === 'webp'
            ? await pipeline.webp({ quality: 90 }).toBuffer()
            : await pipeline.gif().toBuffer();
    return { content: output, width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof MediaFilePolicyError) throw error;
    throw new MediaFilePolicyError('A imagem não pôde ser decodificada com segurança.');
  }
}

async function validatePdf(
  content: Buffer,
): Promise<{ content: Buffer; width: null; height: null }> {
  const source = content
    .toString('latin1')
    .replace(/#([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  const startXref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(source);
  if (!startXref || Number(startXref[1]) >= content.length) {
    throw new MediaFilePolicyError('O PDF não possui uma estrutura final válida.');
  }
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/i.test(source)) {
    throw new MediaFilePolicyError('PDFs com conteúdo ativo ou anexos não são permitidos.');
  }

  try {
    const document = await PDFDocument.load(content, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
      capNumbers: true,
    });
    const pageCount = document.getPageCount();
    if (document.isEncrypted || pageCount < 1 || pageCount > 200) {
      throw new MediaFilePolicyError(
        'O PDF deve estar descriptografado e conter entre 1 e 200 páginas.',
      );
    }
    for (const [, object] of document.context.enumerateIndirectObjects()) {
      if (containsActivePdfObject(object, document.context)) {
        throw new MediaFilePolicyError('PDFs com conteúdo ativo ou anexos não são permitidos.');
      }
    }
  } catch (error) {
    if (error instanceof MediaFilePolicyError) throw error;
    throw new MediaFilePolicyError('O PDF não pôde ser interpretado com segurança.');
  }
  return { content, width: null, height: null };
}

const forbiddenPdfKeys = new Set([
  'AA',
  'AcroForm',
  'EmbeddedFile',
  'EmbeddedFiles',
  'ImportData',
  'JS',
  'JavaScript',
  'Launch',
  'OpenAction',
  'RichMedia',
  'SubmitForm',
  'XFA',
]);
const forbiddenPdfNames = new Set([
  'EmbeddedFile',
  'GoToE',
  'GoToR',
  'ImportData',
  'JavaScript',
  'Launch',
  'RichMedia',
  'SubmitForm',
  'XFA',
]);

function containsActivePdfObject(
  object: PDFObject,
  context: PDFContext,
  seen = new Set<PDFObject>(),
): boolean {
  if (seen.has(object)) return false;
  seen.add(object);
  if (object instanceof PDFRef) {
    const resolved = context.lookup(object);
    return resolved ? containsActivePdfObject(resolved, context, seen) : false;
  }
  if (object instanceof PDFName) {
    return forbiddenPdfNames.has(object.asString().replace(/^\//, ''));
  }
  if (object instanceof PDFRawStream) {
    return containsActivePdfObject(object.dict, context, seen);
  }
  if (object instanceof PDFArray) {
    return object.asArray().some((item) => containsActivePdfObject(item, context, seen));
  }
  if (object instanceof PDFDict) {
    return object.entries().some(([key, value]) => {
      const name = key.asString().replace(/^\//, '');
      return forbiddenPdfKeys.has(name) || containsActivePdfObject(value, context, seen);
    });
  }
  return false;
}

function safeOriginalName(name: string, extension: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  const safeStem = withoutExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return `${safeStem || 'arquivo'}.${extension}`;
}

function boundedLimit(
  raw: string | undefined,
  fallback: number,
  absolute = ABSOLUTE_MEDIA_MAX_BYTES,
): number {
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, absolute);
}
