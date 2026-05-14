// src/routes/auth.js
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function authRoutes(app) {

  // POST /api/auth/register
  // Cria empresa + usuário admin em uma única operação
  app.post('/register', async (request, reply) => {
    const schema = z.object({
      companyName: z.string().min(2, 'Nome da empresa muito curto'),
      name:        z.string().min(2, 'Nome muito curto'),
      email:       z.string().email('E-mail inválido'),
      password:    z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const { companyName, name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.code(409).send({ error: 'E-mail já cadastrado.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const company = await prisma.company.create({
      data: {
        name: companyName,
        users: {
          create: { name, email, passwordHash, role: 'ADMIN' },
        },
      },
      include: { users: true },
    })

    const user = company.users[0]
    const token = app.jwt.sign({ sub: user.id, companyId: company.id, role: user.role })

    return reply.code(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: company.id, name: company.name },
    })
  })

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const schema = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Dados inválidos.' })
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    })

    // Mesmo tempo de resposta independente de usuário existir (evita user enumeration)
    const passwordMatch = user ? await bcrypt.compare(password, user.passwordHash) : false

    if (!user || !passwordMatch) {
      return reply.code(401).send({ error: 'E-mail ou senha incorretos.' })
    }

    const token = app.jwt.sign({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
    })

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: user.company.id, name: user.company.name },
    }
  })

  // GET /api/auth/me  — requer token
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { company: true },
    })

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: user.company.id, name: user.company.name },
    }
  })

  // PATCH /api/auth/password  — troca de senha
  app.patch('/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8, 'Nova senha deve ter no mínimo 8 caracteres'),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
    const match = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)

    if (!match) {
      return reply.code(401).send({ error: 'Senha atual incorreta.' })
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    return { message: 'Senha atualizada com sucesso.' }
  })
}
