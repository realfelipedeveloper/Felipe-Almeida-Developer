import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import { AdminAuthGuard } from '../../auth/presentation/admin-auth.guard';
import { CsrfGuard } from '../../auth/presentation/csrf.guard';
import { CurrentAdmin } from '../../auth/presentation/current-admin.decorator';
import { PasswordReadyGuard } from '../../auth/presentation/password-ready.guard';
import { RolesGuard } from '../../auth/presentation/roles.guard';
import { AdminEngagementService } from '../application/admin-engagement.service';
import {
  ContactListQueryDto,
  NewsletterListQueryDto,
  UpdateContactStatusDto,
  UpdateNewsletterStatusDto,
} from './dto/admin-engagement.dto';

@ApiTags('administração - contatos e newsletter')
@Controller('admin/engagement')
@UseGuards(AdminAuthGuard, PasswordReadyGuard, RolesGuard)
export class AdminEngagementController {
  constructor(private readonly service: AdminEngagementService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'Lista mensagens recebidas pelo formulário de contato' })
  contacts(@Query() query: ContactListQueryDto) {
    return this.service.listContacts(query.status);
  }

  @Patch('contacts/:id/status')
  @UseGuards(CsrfGuard)
  updateContactStatus(
    @Param('id') id: string,
    @Body() body: UpdateContactStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateContactStatus(id, body.status, admin);
  }

  @Get('newsletter')
  @ApiOperation({ summary: 'Lista inscritos da newsletter' })
  newsletter(@Query() query: NewsletterListQueryDto) {
    return this.service.listSubscribers(query.status);
  }

  @Patch('newsletter/:id/status')
  @UseGuards(CsrfGuard)
  updateNewsletterStatus(
    @Param('id') id: string,
    @Body() body: UpdateNewsletterStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateSubscriberStatus(id, body.status, admin);
  }
}
