import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import { AdminAuthGuard } from '../../auth/presentation/admin-auth.guard';
import { CsrfGuard } from '../../auth/presentation/csrf.guard';
import { CurrentAdmin } from '../../auth/presentation/current-admin.decorator';
import { PasswordReadyGuard } from '../../auth/presentation/password-ready.guard';
import { RolesGuard } from '../../auth/presentation/roles.guard';
import { AdminRoles } from '../../auth/presentation/roles.decorator';
import { MediaService } from '../application/media.service';
import { ABSOLUTE_MEDIA_MAX_BYTES } from '../domain/media-file-policy';
import { MediaListQueryDto, UpdateMediaTranslationsDto } from './dto/media.dto';

interface UploadedFileValue {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@ApiTags('administração - mídia')
@Controller('admin/media')
@UseGuards(AdminAuthGuard, PasswordReadyGuard, RolesGuard)
export class AdminMediaController {
  constructor(private readonly service: MediaService) {}

  @Get()
  list(@Query() query: MediaListQueryDto) {
    return this.service.list(query);
  }

  @Get(':id/content')
  async content(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    const media = await this.service.getAdminMedia(id);
    const etag = `"${media.sha256}"`;
    response.set({
      'Content-Type': media.mimeType,
      'Content-Length': String(media.byteSize),
      'Content-Disposition': `inline; filename="${media.originalName.replace(/[\r\n"\\]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      ...(media.kind === 'PDF' ? { 'Content-Security-Policy': 'sandbox' } : {}),
    });
    if (request.headers['if-none-match'] === etag) {
      response.status(304);
      response.removeHeader('Content-Length');
      return undefined;
    }
    return new StreamableFile(await this.service.open(media));
  }

  @Post()
  @UseGuards(CsrfGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fields: 0,
        parts: 1,
        fileSize: ABSOLUTE_MEDIA_MAX_BYTES,
        fieldNameSize: 32,
        headerPairs: 20,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia uma imagem ou currículo PDF validado por assinatura' })
  upload(
    @UploadedFile() file: UploadedFileValue | undefined,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    if (!file) throw new BadRequestException('Envie um arquivo no campo file.');
    return this.service.upload(
      {
        originalName: file.originalname,
        claimedMimeType: file.mimetype,
        buffer: file.buffer,
      },
      admin,
    );
  }

  @Post('reconcile-storage')
  @UseGuards(CsrfGuard)
  @AdminRoles('SUPER_ADMIN')
  reconcileStorage() {
    return this.service.reconcilePendingStorageDeletions();
  }

  @Patch(':id/translations')
  @UseGuards(CsrfGuard)
  updateTranslations(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateMediaTranslationsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateTranslations(id, body.toApplication(), admin);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  @AdminRoles('SUPER_ADMIN')
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.delete(id, admin);
  }
}
