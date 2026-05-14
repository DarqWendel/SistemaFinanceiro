// src/routes/reports.js
import { prisma } from '../lib/prisma.js'

export async function reportRoutes(app) {

  app.addHook('preHandler', app.authenticate)

  // GET /api/reports/dashboard
  // Retorna KPIs do mês atual + últimas 6 semanas para o gráfico + recentes
  app.get('/dashboard', async (request) => {
    const companyId = request.user.companyId
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Saldo total (todas as movimentações)
    const [allIncome, allExpense] = await prisma.$transaction([
      prisma.transaction.aggregate({ where: { companyId, type: 'INCOME'  }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { companyId, type: 'EXPENSE' }, _sum: { amount: true } }),
    ])

    // Mês atual
    const [monthIncome, monthExpense, monthCount] = await prisma.$transaction([
      prisma.transaction.aggregate({
        where: { companyId, type: 'INCOME',  date: { gte: firstOfMonth, lte: lastOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId, type: 'EXPENSE', date: { gte: firstOfMonth, lte: lastOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { companyId, date: { gte: firstOfMonth, lte: lastOfMonth } },
      }),
    ])

    // Últimos 6 meses para o gráfico
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const byMonth = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', date) AS month,
        type,
        SUM(amount)::float        AS total
      FROM "Transaction"
      WHERE "companyId" = ${companyId}
        AND date >= ${sixMonthsAgo}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `

    // Top categorias de despesas
    const topCategories = await prisma.$queryRaw`
      SELECT category, SUM(amount)::float AS total
      FROM "Transaction"
      WHERE "companyId" = ${companyId}
        AND type = 'EXPENSE'
        AND date >= ${firstOfMonth}
      GROUP BY category
      ORDER BY total DESC
      LIMIT 5
    `

    // 5 mais recentes
    const recent = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    })

    const totalIncome  = Number(allIncome._sum.amount  ?? 0)
    const totalExpense = Number(allExpense._sum.amount ?? 0)

    return {
      balance:  totalIncome - totalExpense,
      month: {
        income:  Number(monthIncome._sum.amount  ?? 0),
        expense: Number(monthExpense._sum.amount ?? 0),
        count:   monthCount,
      },
      chart:         byMonth,
      topCategories: topCategories,
      recent,
    }
  })

  // GET /api/reports/monthly?year=2025&month=5
  app.get('/monthly', async (request, reply) => {
    const { year, month } = request.query
    if (!year || !month) {
      return reply.code(400).send({ error: 'Parâmetros year e month são obrigatórios.' })
    }

    const y = Number(year)
    const m = Number(month)
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return reply.code(400).send({ error: 'Ano ou mês inválido.' })
    }

    const start = new Date(y, m - 1, 1)
    const end   = new Date(y, m, 0, 23, 59, 59)
    const companyId = request.user.companyId

    const transactions = await prisma.transaction.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }],
    })

    if (!transactions.length) {
      return { period: { year: y, month: m }, summary: null, transactions: [] }
    }

    const income  = transactions.filter(t => t.type === 'INCOME' ).reduce((a, t) => a + Number(t.amount), 0)
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((a, t) => a + Number(t.amount), 0)

    // Agrupamento por categoria
    const byCategory = transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { income: 0, expense: 0 }
      acc[t.category][t.type === 'INCOME' ? 'income' : 'expense'] += Number(t.amount)
      return acc
    }, {})

    return {
      period: { year: y, month: m },
      summary: { income, expense, balance: income - expense },
      byCategory,
      transactions,
    }
  })

  // GET /api/reports/weekly?startDate=2025-05-05
  app.get('/weekly', async (request, reply) => {
    const { startDate } = request.query
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return reply.code(400).send({ error: 'Parâmetro startDate inválido (YYYY-MM-DD).' })
    }

    const start = new Date(startDate + 'T00:00:00')
    const end   = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59)

    const companyId = request.user.companyId

    const transactions = await prisma.transaction.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }],
    })

    if (!transactions.length) {
      return { period: { startDate, endDate: end.toISOString().split('T')[0] }, summary: null, transactions: [] }
    }

    const income  = transactions.filter(t => t.type === 'INCOME' ).reduce((a, t) => a + Number(t.amount), 0)
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((a, t) => a + Number(t.amount), 0)

    // Agrupamento por dia da semana
    const byDay = transactions.reduce((acc, t) => {
      const day = new Date(t.date).toISOString().split('T')[0]
      if (!acc[day]) acc[day] = { income: 0, expense: 0, count: 0 }
      acc[day][t.type === 'INCOME' ? 'income' : 'expense'] += Number(t.amount)
      acc[day].count++
      return acc
    }, {})

    return {
      period: { startDate, endDate: end.toISOString().split('T')[0] },
      summary: { income, expense, balance: income - expense },
      byDay,
      transactions,
    }
  })
}
