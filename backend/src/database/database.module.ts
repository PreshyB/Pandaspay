import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('database.url'),
        host: config.get('database.url') ? undefined : config.get('database.host'),
        port: config.get('database.url') ? undefined : config.get('database.port'),
        username: config.get('database.url') ? undefined : config.get('database.username'),
        password: config.get('database.url') ? undefined : config.get('database.password'),
        database: config.get('database.url') ? undefined : config.get('database.database'),
        autoLoadEntities: true,
        synchronize: config.get('database.synchronize'),
      }),
    }),
  ],
})
export class DatabaseModule {}
