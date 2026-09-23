import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

// CLI-only. The runtime client does not use a URL at all — it builds a
// PrismaMariaDb adapter from the same variables in backend/prisma.ts.
// Composed from DB_* so `prisma db pull` works with the existing env contract.
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || 'root');
  const pass = encodeURIComponent(process.env.DB_PASSWORD ?? '');
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 4000;
  const name = process.env.DB_NAME || 'chityapp';
  const query = process.env.DB_SSL === 'true' ? '?sslaccept=strict' : '';
  return `mysql://${user}:${pass}@${host}:${port}/${name}${query}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: databaseUrl() },
});
