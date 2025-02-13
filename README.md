## basecode elysia backend


### Stack 📚

- Bun
- Prisma
- PostgreSQL



### Endpoints 📡

```shell
/swagger
```

### Installs 🛠️

```shell
bun install
```

### Run 🏃

```shell
bunx prisma db push
bun dev
```


# backendelysia

To install dependencies:



To run:

```bash
bun run index.ts
```
install postgres client
```bash
bun add pg
```
Install dotenv pour charger les variables d'environnement :
```bash
bun add dotenv
```
ajouter les types nécessaires, ce qui permettra à TypeScript de comprendre les types du module pg.
```bash
bun add -D @types/pg
```


This project was created using `bun init` in bun v1.1.43. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.