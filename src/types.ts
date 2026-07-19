import type { Context } from 'hono'

export interface Bindings {
  PDF_RATE_LIMITER: RateLimit
}

export type Env = { Bindings: Bindings }
export type AppContext = Context<Env>
