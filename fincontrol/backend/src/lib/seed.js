import bcrypt from 'bcryptjs'
import { prisma } from './prisma.js'

async function main() {
  console.log('🌱 Rodando seed...')

  const existing = await prisma.user.findUnique({ where: { email: 'admin@fincontrol.com' } })
  if (existing) {
    console.log('✅ Seed já executado anteriormente. Pulando.')
    return
  }

  const passwordHash = await bcrypt.hash('Admin@1234', 12)

  const company = await prisma.company.create({
    data: {
      name: 'Empresa Demo',
      users: {
        create: {
          name:  'Administrador',
          email: 'admin@fincontrol.com',
          passwordHash,
          role:  'ADMIN',
        },
      },
    },
    include: { users: true },
  })

  const companyId = company.id

  // Movimentações de demonstração
  const now = new Date()
  const demos = [
    { type: 'INCOME',  description: 'Venda de serviços — cliente A',  amount: 8500, date: new Date(now.getFullYear(), now.getMonth(), 3),  category: 'Serviços'       },
    { type: 'INCOME',  description: 'Contrato recorrente mensal',      amount: 3200, date: new Date(now.getFullYear(), now.getMonth(), 8),  category: 'Serviços'       },
    { type: 'EXPENSE', description: 'Folha de pagamento',              amount: 5400, date: new Date(now.getFullYear(), now.getMonth(), 5),  category: 'Pessoal'        },
    { type: 'EXPENSE', description: 'Aluguel do escritório',           amount: 1800, date: new Date(now.getFullYear(), now.getMonth(), 1),  category: 'Infraestrutura' },
    { type: 'INCOME',  description: 'Consultoria projeto X',           amount: 2200, date: new Date(now.getFullYear(), now.getMonth(), 12), category: 'Serviços'       },
    { type: 'EXPENSE', description: 'Ferramentas e licenças',          amount:  480, date: new Date(now.getFullYear(), now.getMonth(), 10), category: 'Infraestrutura' },
    { type: 'EXPENSE', description: 'Campanha Google Ads',             amount:  650, date: new Date(now.getFullYear(), now.getMonth(), 14), category: 'Marketing'      },
    { type: 'INCOME',  description: 'Venda de produto digital',        amount: 1100, date: new Date(now.getFullYear(), now.getMonth()-1, 20), category: 'Vendas'       },
    { type: 'EXPENSE', description: 'SIMPLES Nacional',                amount:  920, date: new Date(now.getFullYear(), now.getMonth()-1, 25), category: 'Impostos'     },
  ]

  await prisma.transaction.createMany({
    data: demos.map(d => ({ ...d, companyId })),
  })

  console.log(`✅ Seed concluído!`)
  console.log(`   Empresa: ${company.name}`)
  console.log(`   Login:   admin@fincontrol.com`)
  console.log(`   Senha:   Admin@1234`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
