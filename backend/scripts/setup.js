import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (!existsSync(envPath)) {
  const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  writeFileSync(
    envPath,
    template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`),
  );
  console.log('Configuración local creada en backend/.env.');
}
const { connectDatabase, sql } = await import('../src/db.js');
const name = process.env.DB_NAME || 'FarmaInventario';
if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name))
  throw new Error('DB_NAME solo puede contener letras, números y guion bajo.');
let master, db;
try {
  master = await connectDatabase('master');
  await master
    .request()
    .query(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}] COLLATE Latin1_General_100_CI_AI;`);
  await master.close();
  db = await connectDatabase(name);
  for (const file of ['01-schema.sql', ...(process.argv.includes('--no-demo') ? [] : ['02-demo-data.sql'])]) {
    const script = readFileSync(new URL(`../../database/${file}`, import.meta.url), 'utf8');
    for (const batch of script.split(/^\s*GO\s*$/gim).filter((s) => s.trim()))
      await db.request().batch(batch);
    console.log(`${file}: correcto.`);
  }
  const email = process.env.ADMIN_EMAIL || 'admin@farma.local';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
  await db
    .request()
    .input('email', sql.NVarChar(150), email)
    .input('hash', sql.NVarChar(255), await bcrypt.hash(password, 12))
    .query(`IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email=@email)
      INSERT dbo.Users(name,email,passwordHash) VALUES(N'Administrador',@email,@hash);`);
  console.log(`Base ${name} preparada. Administrador: ${email}. La contraseña se define en backend/.env.`);
} catch (error) {
  console.error('No se pudo preparar SQL Server:', error.message);
  console.error('Revisa backend/.env, el servicio SQL Server, TCP/IP y el controlador ODBC.');
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  if (master?.connected) await master.close();
}
