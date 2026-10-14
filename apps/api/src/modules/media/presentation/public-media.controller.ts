import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MediaService } from '../application/media.service';
import type { MediaRecord } from '../application/media.repository';
import { MediaRateLimitGuard } from './media-rate-limit.guard';

@Controller('media')
@UseGuards(MediaRateLimitGuard)
export class PublicMediaController {
  constructor(private readonly service: MediaService) {}

  @Get(':id')
  async read(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    const media = await this.service.getPublicMedia(id);
    if (this.setHeadersAndCheckFreshness(media, request, response)) return undefined;
    return new StreamableFile(await this.service.open(media));
  }

  private setHeadersAndCheckFreshness(
    media: MediaRecord,
    request: Request,
    response: Response,
  ): boolean {
    const etag = `"${media.sha256}"`;
    const disposition = media.kind === 'PDF' ? 'attachment' : 'inline';
    const safeName = media.originalName.replace(/[\r\n"\\]/g, '_');
    response.set({
      'Content-Type': media.mimeType,
      'Content-Length': String(media.byteSize),
      'Content-Disposition': `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(media.originalName)}`,
      'Cache-Control': 'public, max-age=300, must-revalidate',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      ...(media.kind === 'PDF' ? { 'Content-Security-Policy': 'sandbox' } : {}),
    });
    if (request.headers['if-none-match'] !== etag) return false;
    response.status(304);
    response.removeHeader('Content-Length');
    return true;
  }
}
