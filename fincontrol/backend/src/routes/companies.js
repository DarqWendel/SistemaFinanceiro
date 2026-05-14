// src/routes/companies.js
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function companyRoutes(app) {

  app.addHook('preHandler', app.authenticate)

  // GET /api/companies/me
  app.get('/me', async (request) => {
    const company = await prisma.company.findUnique({
      where: { id: request.user.companyId },
    })
    return company
  })

  // PATCH /api/companies/me
  app.patch('/me', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2, 'Nome muito curto').max(100),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const company = await prisma.company.update({
      where: { id: request.user.companyId },
      data: { name: parsed.data.name },
    })

    return company
  })
}
