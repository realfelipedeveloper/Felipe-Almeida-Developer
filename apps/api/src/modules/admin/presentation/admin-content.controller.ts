import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminContentService } from '../application/admin-content.service';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import { AdminAuthGuard } from '../../auth/presentation/admin-auth.guard';
import { CsrfGuard } from '../../auth/presentation/csrf.guard';
import { CurrentAdmin } from '../../auth/presentation/current-admin.decorator';
import { PasswordReadyGuard } from '../../auth/presentation/password-ready.guard';
import { RolesGuard } from '../../auth/presentation/roles.guard';
import {
  UpdateProfileAdminDto,
  UpsertArticleAdminDto,
  UpsertNewsAdminDto,
  UpsertProjectAdminDto,
} from './dto/admin-content.dto';

@ApiTags('administração - conteúdo')
@Controller('admin/content')
@UseGuards(AdminAuthGuard, PasswordReadyGuard, RolesGuard)
export class AdminContentController {
  constructor(private readonly service: AdminContentService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Resumo do painel administrativo' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('options')
  @ApiOperation({ summary: 'Lista tecnologias e tags disponíveis para o painel' })
  options() {
    return this.service.options();
  }

  @Get('profile')
  getProfile() {
    return this.service.getProfile();
  }

  @Patch('profile')
  @UseGuards(CsrfGuard)
  updateProfile(@Body() body: UpdateProfileAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.updateProfile(body, admin);
  }

  @Get('projects')
  listProjects() {
    return this.service.listProjects();
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.service.getProject(id);
  }

  @Post('projects')
  @UseGuards(CsrfGuard)
  createProject(@Body() body: UpsertProjectAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.createProject(body, admin);
  }

  @Patch('projects/:id')
  @UseGuards(CsrfGuard)
  updateProject(
    @Param('id') id: string,
    @Body() body: UpsertProjectAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateProject(id, body, admin);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  deleteProject(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.deleteProject(id, admin);
  }

  @Get('articles')
  listArticles() {
    return this.service.listArticles();
  }

  @Get('articles/:id')
  getArticle(@Param('id') id: string) {
    return this.service.getArticle(id);
  }

  @Post('articles')
  @UseGuards(CsrfGuard)
  createArticle(@Body() body: UpsertArticleAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.createArticle(body, admin);
  }

  @Patch('articles/:id')
  @UseGuards(CsrfGuard)
  updateArticle(
    @Param('id') id: string,
    @Body() body: UpsertArticleAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateArticle(id, body, admin);
  }

  @Delete('articles/:id')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  deleteArticle(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.deleteArticle(id, admin);
  }

  @Get('news')
  listNews() {
    return this.service.listNews();
  }

  @Get('news/:id')
  getNews(@Param('id') id: string) {
    return this.service.getNews(id);
  }

  @Post('news')
  @UseGuards(CsrfGuard)
  createNews(@Body() body: UpsertNewsAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.createNews(body, admin);
  }

  @Patch('news/:id')
  @UseGuards(CsrfGuard)
  updateNews(
    @Param('id') id: string,
    @Body() body: UpsertNewsAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.updateNews(id, body, admin);
  }

  @Delete('news/:id')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  deleteNews(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.deleteNews(id, admin);
  }
}
