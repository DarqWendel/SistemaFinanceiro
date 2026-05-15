# SistemaFinanceiro

Aplicação web para controle e prestação de contas financeiras, permitindo registrar entradas e saídas, acompanhar saldo e gerar relatórios financeiros.

---

## Tecnologias

- **Node.js** com **Fastify** — servidor HTTP leve e rápido
- **Prisma** — ORM para comunicação com o banco de dados
- **PostgreSQL** (via pgAdmin 4) — banco de dados relacional
- **JWT** — autenticação com token de acesso
- **HTML/CSS/JS** — frontend em arquivo único, sem framework

---

## Estrutura

```
fincontrol/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   ├── reports.js
│   │   │   └── companies.js
│   │   └── lib/
│   │       ├── prisma.js
│   │       └── seed.js
│   ├── .env.example
│   └── package.json
└── frontend/
    └── sistema-financeiro.html
```

---

## Como rodar localmente

### Pré-requisitos
- Node.js 20+
- PostgreSQL rodando (pode usar o pgAdmin 4)

### Instalação

```bash
cd backend
npm install
```

### Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com a URL do seu banco e um JWT secret.

### Banco de dados

```bash
npm run db:generate
npm run db:migrate
```

Opcional — popular com dados de demonstração:

```bash
npm run db:seed
```

### Iniciar

```bash
npm run dev
```

---

## Funcionalidades

- Cadastro de empresa e usuário administrador
- Login com JWT (expiração de 8h)
- Registro de entradas e saídas com categorias
- Filtros por tipo, categoria e período
- Dashboard com saldo e KPIs do mês
- Relatórios mensais e semanais
- Cada empresa acessa apenas seus próprios dados
