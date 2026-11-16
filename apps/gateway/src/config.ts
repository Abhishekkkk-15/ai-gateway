import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  masterSecret: string;
  jwtSecret: string;
  adminUsername: string;
  adminPasswordHash?: string;
  adminPassword?: string;
  allowedOrigins: string[];
}

export function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const databaseUrl = process.env.DATABASE_URL || '';
  const masterSecret = process.env.MASTER_SECRET || 'default-master-secret-at-least-32-chars-long!';
  const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-at-least-32-chars-long!';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '*';
  const allowedOrigins = allowedOriginsStr === '*'
    ? ['*']
    : allowedOriginsStr.split(',').map((o) => o.trim());

  return {
    port,
    host,
    databaseUrl,
    masterSecret,
    jwtSecret,
    adminUsername,
    adminPasswordHash,
    adminPassword,
    allowedOrigins,
  };
}
