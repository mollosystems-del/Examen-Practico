import { config } from './config.js';
import { createApp } from './app.js';
import { closeDatabase, getPool } from './db.js';

if (!config.secret || config.secret.length < 32) {
  console.error(
    'JWT_SECRET debe tener al menos 32 caracteres. Ejecuta npm run setup o configura backend/.env.',
  );
  process.exit(1);
}
try {
  await getPool();
  const server = createApp().listen(config.port, '127.0.0.1', () =>
    console.log(`Farma API · http://127.0.0.1:${config.port}`),
  );
  const shutdown = () =>
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('No se pudo conectar con SQL Server:', error.message);
  console.error('Revisa backend/.env y ejecuta npm run setup.');
  process.exit(1);
}
