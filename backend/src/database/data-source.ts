import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/revert).
 * Kept separate from DatabaseModule's forRootAsync wiring, which is what
 * the running app actually uses.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST ?? 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DATABASE_URL ? undefined : (process.env.DB_USERNAME ?? 'pandaspay'),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD ?? 'pandaspay'),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME ?? 'pandaspay'),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
