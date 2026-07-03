// src/routes/bills.js
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const billSchema = z.object({
  name:      z.string().min(1, 'Nome obrigatório').max(255),
  amount:    z.number().positive('Valor deve ser maior que zero').finite().multipleOf(0.01),
  dueDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  category:  z.string().min(1, 'Categoria obrigatória').max(100),
  recurrent: z.boolean().optional().default(false),
  notes:     z.string().max(500).optional(),
})

// Atualiza automaticamente status para OVERDUE se vencida
function resolveStatus(bill) {
  if (bill.status === 'PAID') return 'PAID'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(bill.dueDate); due.setHours(0, 0, 0, 0)
  return due < today ? 'OVERDUE' : 'PENDING'
}

export async function billRoutes(app) {

  app.addHook('preHandler', app.authenticate)

  // GET /api/bills
  // Suporta filtros: ?status=PENDING&month=2025-07
  app.get('/', async (request) => {
    const { status, month } = request.query
    const companyId = request.user.companyId

    const where = {
      companyId,
      ...(status && { status }),
      ...(month && (() => {
        const [y, m] = month.split('-')
        const start = new Date(y, m - 1, 1)
        const end   = new Date(y, m, 0)
        return { dueDate: { gte: start, lte: end } }
      })()),
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    })

    // Atualiza status de vencidas automaticamente
    const updated = await Promise.all(
      bills.map(async (b) => {
        const newStatus = resolveStatus(b)
        if (newStatus !== b.status) {
          return prisma.bill.update({ where: { id: b.id }, data: { status: newStatus } })
        }
        return b
      })
    )

    return updated
  })

  // POST /api/bills
  app.post('/', async (request, reply) => {
    const parsed = billSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const { name, amount, dueDate, category, recurrent, notes } = parsed.data

    const bill = await prisma.bill.create({
      data: {
        name, amount, category, recurrent,
        notes: notes || null,
        dueDate:   new Date(dueDate),
        status:    'PENDING',
        companyId: request.user.companyId,
      },
    })

    return reply.code(201).send(bill)
  })

  // PATCH /api/bills/:id/pay — marcar como pago
  app.patch('/:id/pay', async (request, reply) => {
    const existing = await prisma.bill.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Conta não encontrada.' })

    const bill = await prisma.bill.update({
      where: { id: request.params.id },
      data:  { status: 'PAID', paidAt: new Date() },
    })

    // Se for recorrente, cria a próxima conta (mesmo dia, mês seguinte)
    if (existing.recurrent) {
      const next = new Date(existing.dueDate)
      next.setMonth(next.getMonth() + 1)
      await prisma.bill.create({
        data: {
          name:      existing.name,
          amount:    existing.amount,
          category:  existing.category,
          recurrent: true,
          notes:     existing.notes,
          dueDate:   next,
          status:    'PENDING',
          companyId: existing.companyId,
        },
      })
    }

    return bill
  })

  // PATCH /api/bills/:id — editar conta
  app.patch('/:id', async (request, reply) => {
    const existing = await prisma.bill.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Conta não encontrada.' })

    const parsed = billSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0].message })
    }

    const data = parsed.data
    if (data.dueDate) data.dueDate = new Date(data.dueDate)

    const bill = await prisma.bill.update({ where: { id: request.params.id }, data })
    return bill
  })

  // DELETE /api/bills/:id
  app.delete('/:id', async (request, reply) => {
    const existing = await prisma.bill.findFirst({
      where: { id: request.params.id, companyId: request.user.companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Conta não encontrada.' })

    await prisma.bill.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
