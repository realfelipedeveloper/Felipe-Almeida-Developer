import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { RabbitMqModule } from './infra/rabbitmq/rabbitmq.module';
import { LoggingModule } from './infra/logging/logging.module';
import { CorrelationIdMiddleware } from './infra/logging/correlation-id.middleware';
import { ProfileModule } from './modules/profile/profile.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { NewsModule } from './modules/news/news.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { EngagementModule } from './modules/engagement/engagement.module';

@Module({
  imports: [
    LoggingModule,
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    HealthModule,
    ProfileModule,
    ProjectsModule,
    ArticlesModule,
    NewsModule,
    AuthModule,
    AdminModule,
    EngagementModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
