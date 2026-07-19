import type { Context } from 'hono'

export type Bindings = Record<string, never>

export type Env = { Bindings: Bindings }
export type AppContext = Context<Env>
