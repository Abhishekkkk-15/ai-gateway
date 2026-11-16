import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { adminUsersTable, verifyPassword, eq } from '@ai-gateway/db';

export interface AdminJwtPayload {
  username: string;
  role: 'admin';
}

export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies.admin_token || request.headers.authorization?.replace(/^Bearer\s+/, '');

  if (!token) {
    reply.status(401).send({ error: 'Unauthorized: Admin authentication required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, request.server.appConfig.jwtSecret) as AdminJwtPayload;
    (request as unknown as { adminUser: AdminJwtPayload }).adminUser = decoded;
  } catch {
    reply.status(401).send({ error: 'Unauthorized: Invalid or expired admin token.' });
  }
}

export const adminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { username?: string; password?: string } }>('/api/admin/login', async (request, reply) => {
    const { username, password } = request.body || {};
    const config = fastify.appConfig;

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required.' });
    }

    let isValid = false;

    // 1. Check against DB if available
    if (fastify.db) {
      try {
        const rows = await fastify.db
          .select()
          .from(adminUsersTable)
          .where(eq(adminUsersTable.username, username))
          .limit(1);

        if (rows.length > 0) {
          isValid = await verifyPassword(password, rows[0].passwordHash);
        }
      } catch (err) {
        console.error('[AdminAuth] DB auth check error:', err);
      }
    }

    // 2. Fallback to ENV configuration if DB not initialized or not matched
    if (!isValid) {
      if (username === config.adminUsername) {
        if (config.adminPassword && password === config.adminPassword) {
          isValid = true;
        } else if (config.adminPasswordHash) {
          isValid = await verifyPassword(password, config.adminPasswordHash);
        }
      }
    }

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid username or password.' });
    }

    const payload: AdminJwtPayload = { username, role: 'admin' };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    reply.setCookie('admin_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return reply.status(200).send({
      message: 'Login successful',
      user: { username, role: 'admin' },
      token, // also return in body for clients that prefer Bearer header
    });
  });

  fastify.post('/api/admin/logout', async (request, reply) => {
    reply.clearCookie('admin_token', { path: '/' });
    return { message: 'Logged out successfully' };
  });

  fastify.get('/api/admin/me', { preHandler: authenticateAdmin }, async (request) => {
    const adminUser = (request as unknown as { adminUser: AdminJwtPayload }).adminUser;
    return { user: adminUser };
  });
};
