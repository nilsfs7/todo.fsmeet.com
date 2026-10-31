# Todo

Official freestyle football community governance app (part of FSMeet).

## Stack

- Next.js (port **3003**)
- FSMeet OAuth
- Docker / GitHub Actions → Docker Hub (`nilsfs7/fsmeet-todo`)

## Local development

```bash
cp .env.example .env
docker compose up -d mysql adminer
npm install
npm run dev
```
