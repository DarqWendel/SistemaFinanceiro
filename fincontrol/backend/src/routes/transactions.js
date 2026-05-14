// src/routes/transactions.js
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const transactionSchema = z.object({
  type:        z.enum(['INCOME', 'EXPENSE'], { message: 'Tipo deve ser INCOME ou EXPENSE' }),
  description: z.string().min(1, 'Descrição obrigatória').max(255),
  amount:      z.number()
                 .positive('Valor deve ser maior que zero')
                 .finite()
                 .multipleOf(0.01, 'Máximo 2 casas decimais'),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  category:    z.string().min(1, 'Categoria obrigatória').max(100),
})

export async function transactionRoutes(app) {

  // Todas as rotas exigem autenticação
  app.addHook('preHandler', app.authenticate)

  // GET /api/transactions
  // Suporta filtros: ?type=INCOME&category=Vendas&startDate=2025-01-01&endDate=2025-01-31&page=1&limit=20
  app.get('/', async (request) => {
    const { type, category, startDate, endDate, page = '1', limit = '20' } = request.query
    const companyId = request.user.companyId

    const where = {
      companyId,
      ...(type     && { type }),
      ...(category && { category }),
      ...(startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate   && { lte: new Date(endDate + 'T23:59:59') }),
        },
      },
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: Number(limit),
      }),
      prisma.transaction.count({ where }),
    ])

    return {
      data: transactions,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/transactions/:id
  app.get('/:id', async (request, reply) => {
    const tx = await prisma.transaction.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })

    if (!tx) return reply.code(404).send({ error: 'Movimentação não encontrada.' })
    return tx
  })

  // POST /api/transactions
  app.post('/', async (request, reply) => {
    const parsed = transactionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const { type, description, amount, date, category } = parsed.data

    const tx = await prisma.transaction.create({
      data: {
        type,
        description,
        amount,
        date:      new Date(date),
        category,
        companyId: request.user.companyId,
      },
    })

    return reply.code(201).send(tx)
  })

  // PATCH /api/transactions/:id
  app.patch('/:id', async (request, reply) => {
    // Verifica que a transação pertence à empresa do usuário
    const existing = await prisma.transaction.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Movimentação não encontrada.' })

    const parsed = transactionSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const data = parsed.data
    if (data.date) data.date = new Date(data.date)

    const tx = await prisma.transaction.update({
      where: { id: request.params.id },
      data,
    })

    return tx
  })

  // DELETE /api/transactions/:id
  app.delete('/:id', async (request, reply) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Movimentação não encontrada.' })

    await prisma.transaction.delete({ where: { id: request.params.id } })

    return reply.code(204).send()
  })
}
