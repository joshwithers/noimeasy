import type { Context } from 'hono'

export type Bindings = {
  KV: KVNamespace
  RESEND_API_KEY: string
  GOOGLE_MAPS_API_KEY: string
  NOTIFICATION_EMAIL: string
}

export type Env = { Bindings: Bindings }
export type AppContext = Context<Env>
