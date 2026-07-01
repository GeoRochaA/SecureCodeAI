# SecureCode Scanner

Analisador estático de vulnerabilidades em código. Cole qualquer trecho de código e o scanner detecta vulnerabilidades automaticamente, classifica por severidade e aponta possíveis correções.

## Stack

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Banco**: SQLite

## Início rápido

1. Instale dependências:

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Inicie o backend (terminal 1):

```bash
cd backend
npm run dev
```

3. Inicie o frontend (terminal 2):

```bash
cd frontend
npm run dev
```

Abra `http://localhost:5173`

## Build para produção

Backend:

```bash
cd backend
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm preview
```

## Como usar

1. Cole o código que deseja analisar.
2. Clique em **Analisar**.
3. Veja os resultados com vulnerabilidades e severidade.

## Observações

- O projeto não depende de arquivos `.env` para funcionar localmente.
- O frontend usa proxy para `/api` direcionado ao backend em `http://localhost:3000`.

## Licença

MIT
