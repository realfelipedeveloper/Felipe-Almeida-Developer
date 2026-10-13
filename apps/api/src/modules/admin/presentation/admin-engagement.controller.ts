import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
  UpsertNewsletterIssueAdminDto,
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

  @Get('newsletter/issues')
  @ApiOperation({ summary: 'Lista edições da newsletter' })
  issues() {
    return this.service.listIssues();
  }

  @Get('newsletter/issues/:id')
  getIssue(@Param('id') id: string) {
    return this.service.getIssue(id);
  }

  @Post('newsletter/issues')
  @UseGuards(CsrfGuard)
  createIssue(
    @Body() body: UpsertNewsletterIssueAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.createIssue(body, admin);
  }

  @Patch('newsletter/issues/:id')
  @UseGuards(CsrfGuard)
  updateIssue(
    @Param('id') id: string,
    @Body() body: UpsertNewsletterIssueAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateIssue(id, body, admin);
  }

  @Delete('newsletter/issues/:id')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  deleteIssue(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.deleteIssue(id, admin);
  }
}
