# 💰 FinControl — Backend

API REST para o sistema de Prestação de Contas Financeiras.  
**Stack:** Node.js · Fastify · Prisma · PostgreSQL · JWT

---

## Estrutura do projeto

```
fincontrol/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modelos do banco
│   │   └── migrations/            # Histórico de migrations
│   ├── src/
│   │   ├── server.js              # Entrada da aplicação
│   │   ├── routes/
│   │   │   ├── auth.js            # Login, register, me, troca de senha
│   │   │   ├── transactions.js    # CRUD de movimentações
│   │   │   ├── reports.js         # Dashboard, relatório mensal e semanal
│   │   │   └── companies.js       # Dados da empresa
│   │   └── lib/
│   │       ├── prisma.js          # Cliente Prisma singleton
│   │       └── seed.js            # Dados iniciais de demonstração
│   ├── .env.example
│   └── package.json
└── frontend/
    └── index.html                 # Frontend completo (conecta na API)
```

---

## Endpoints da API

### Auth
| Método | Rota                 | Descrição                     | Auth? |
|--------|----------------------|-------------------------------|-------|
| POST   | /api/auth/register   | Cria empresa + usuário admin  | ❌    |
| POST   | /api/auth/login      | Login, retorna JWT            | ❌    |
| GET    | /api/auth/me         | Dados do usuário logado       | ✅    |
| PATCH  | /api/auth/password   | Troca de senha                | ✅    |

### Movimentações
| Método | Rota                      | Descrição                              | Auth? |
|--------|---------------------------|----------------------------------------|-------|
| GET    | /api/transactions         | Lista com filtros e paginação          | ✅    |
| GET    | /api/transactions/:id     | Detalhe de uma movimentação            | ✅    |
| POST   | /api/transactions         | Cadastrar nova movimentação            | ✅    |
| PATCH  | /api/transactions/:id     | Editar movimentação                    | ✅    |
| DELETE | /api/transactions/:id     | Excluir movimentação                   | ✅    |

**Filtros disponíveis (query params):**  
`?type=INCOME|EXPENSE&category=Serviços&startDate=2025-01-01&endDate=2025-01-31&page=1&limit=20`

### Relatórios
| Método | Rota                      | Descrição                              | Auth? |
|--------|---------------------------|----------------------------------------|-------|
| GET    | /api/reports/dashboard    | KPIs do mês atual + recentes           | ✅    |
| GET    | /api/reports/monthly      | Relatório mensal `?year=2025&month=5`  | ✅    |
| GET    | /api/reports/weekly       | Relatório semanal `?startDate=YYYY-MM-DD` | ✅ |

### Empresa
| Método | Rota               | Descrição                    | Auth? |
|--------|--------------------|------------------------------|-------|
| GET    | /api/companies/me  | Dados da empresa logada      | ✅    |
| PATCH  | /api/companies/me  | Atualizar nome da empresa    | ✅    |

---

## Setup local

### 1. Pré-requisitos
- Node.js 20+
- PostgreSQL rodando localmente (ou use Railway/Render)

### 2. Instalar dependências
```bash
cd backend
npm install
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com sua DATABASE_URL e um JWT_SECRET forte
```

Gere um JWT_SECRET seguro:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Rodar as migrations
```bash
npm run db:generate   # gera o cliente Prisma
npm run db:migrate    # aplica as migrations no banco
```

### 5. Popular com dados de demonstração (opcional)
```bash
npm run db:seed
# Login: admin@fincontrol.com / Admin@1234
```

### 6. Iniciar o servidor
```bash
npm run dev   # desenvolvimento (com auto-reload)
npm start     # produção
```

---

## Deploy no Railway (recomendado)

1. Crie uma conta em [railway.app](https://railway.app)
2. Novo projeto → **"Deploy from GitHub repo"**
3. Adicione um serviço PostgreSQL: **"Add service" → "Database" → "PostgreSQL"**
4. O Railway vai gerar `DATABASE_URL` automaticamente — copie e adicione nas variáveis do serviço Node
5. Adicione as variáveis de ambiente:
   ```
   JWT_SECRET=<seu-secret-gerado>
   FRONTEND_URL=<url-do-seu-frontend>
   NODE_ENV=production
   ```
6. Em **Settings → Deploy**, configure o comando de start:
   ```
   npm run db:migrate && npm start
   ```

---

## Deploy no Render

1. Crie conta em [render.com](https://render.com)
2. **New → Web Service** → conecte seu repositório
3. **New → PostgreSQL** → crie o banco e copie a `DATABASE_URL`
4. Nas variáveis de ambiente do Web Service, adicione `DATABASE_URL` e `JWT_SECRET`
5. **Build command:** `npm install && npm run db:generate`
6. **Start command:** `npm run db:migrate && npm start`

---

## Frontend

O arquivo `frontend/index.html` é o frontend completo.  
Antes de usar em produção, edite a linha no topo do `<script>`:

```js
const API = 'https://seu-backend.onrender.com/api'
```

Você pode hospedar o HTML em qualquer lugar (Vercel, Netlify, GitHub Pages, ou servir pelo próprio backend).

---

## Segurança implementada

- ✅ Senhas com bcrypt (salt rounds: 12)
- ✅ JWT com expiração de 8h
- ✅ Isolamento por empresa — usuário só acessa os próprios dados
- ✅ Validação de todos os inputs com Zod (frontend + backend)
- ✅ Proteção contra user enumeration no login
- ✅ CORS configurável por variável de ambiente
- ✅ Valores negativos rejeitados na API
- ✅ Campos obrigatórios validados antes de gravar no banco
