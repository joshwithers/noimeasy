import type { Context } from 'hono'

export type Bindings = {
  RESEND_API_KEY: string
  GOOGLE_MAPS_API_KEY: string
  EMAIL_FROM: string
}

export type Env = { Bindings: Bindings }
export type AppContext = Context<Env>
