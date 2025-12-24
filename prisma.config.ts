import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://dummy:dummy@localhost:5432/dummy",
  },
})
