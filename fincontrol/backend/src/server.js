// src/server.js
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { authRoutes } from './routes/auth.js'
import { transactionRoutes } from './routes/transactions.js'
import { reportRoutes } from './routes/reports.js'
import { companyRoutes } from './routes/companies.js'

const app = Fastify({ logger: true })

// ── Plugins ──────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET não definido') })(),
  sign: { expiresIn: '8h' },
})

// ── Decorator: autenticação ───────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Não autorizado. Faça login novamente.' })
  }
})

// ── Rotas ─────────────────────────────────────────────────
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(transactionRoutes, { prefix: '/api/transactions' })
await app.register(reportRoutes, { prefix: '/api/reports' })
await app.register(companyRoutes, { prefix: '/api/companies' })

// Health check
app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const __dirname = dirname(fileURLToPath(import.meta.url))
app.get('/', (request, reply) => {
  const html = readFileSync(join(process.cwd(), '../frontend/sistema-financeiro.html'), 'utf-8')
  reply.type('text/html').send(html)
})

// ── Start ─────────────────────────────────────────────────
try {
  await app.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
