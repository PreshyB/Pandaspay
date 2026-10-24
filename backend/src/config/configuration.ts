export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'pandaspay',
    password: process.env.DB_PASSWORD ?? 'pandaspay',
    database: process.env.DB_NAME ?? 'pandaspay',
    synchronize: process.env.DB_SYNCHRONIZE === 'true', // dev convenience only — migrations drive prod schema
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
});
