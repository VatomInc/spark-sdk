import Koa from 'koa'
import route from 'koa-route'
import bodyParser from 'koa-bodyparser'

const crypto = require("crypto").webcrypto;

type Facade<EventMap extends Record<string, any>> = {
  id: string
  types?: Array<{ id: keyof EventMap, actions: string[] }>
  events?: string[]
}

type Control = {
  id: string
}

type Descriptor<EventMap extends Record<string, any>> = {
  plugin_id: string
  facades: Facade<EventMap>[]
  controls: Control[]
}

type EventHandler<T extends Array<any>> = (payload: T) => Promise<void> | void

async function verifyVatomSignature(bodyString: string, signature: string, secret: string) {
  const alg = { name: "HMAC", hash: "SHA-256" }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    alg,
    false, // not exportable
    ["verify"],
  )

  const signatureBuffer = new Uint8Array(Buffer.from(signature, "base64"))

  const valid = await crypto.subtle.verify(
    alg,
    key,
    signatureBuffer,
    new TextEncoder().encode(bodyString),
  )

  if (!valid) throw new Error("signature invalid")
}

export default class Spark<EventMap extends Record<string, any>> {
  private app = new Koa()
  private handlers: {
    [K in keyof EventMap]?: EventHandler<EventMap[K]>
  } = {}

  private port = 3000
  private descriptor: Descriptor<EventMap>
  private clientId: string
  private clientSecret: string

  constructor(descriptor: Descriptor<EventMap>, clientId: string, clientSecret: string, private signingSecret: string) {
    this.descriptor = descriptor
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  start() {
    this.app.use(bodyParser())

    this.app.use(
      route.get('/plugin.json', ctx => {
        ctx.body = this.descriptor
      })
    )

    this.app.use(
      route.post('/events', async ctx => {
        const bodyString = ctx.request.rawBody
        const signature = ctx.get("x-signature-sha256")

        try {
          await verifyVatomSignature(bodyString, signature, this.signingSecret)
        } catch (e) {
          if (e instanceof Error && e.message === "signature invalid") {
            ctx.status = 401
            ctx.body = { error: "signature invalid" }
          } else {
            throw e
          }
        }

        const body = ctx.request.body
        const type = (body as any).type
        const handler = this.handlers[type]

        if (handler) {
          ctx.body = await handler(ctx.request.body as any)
        }
      })
    )

    this.app.listen(this.port)
    console.info(`Spark started on port: ${this.port}`)
  }

  on<T extends keyof EventMap>(type: T, handler: EventHandler<EventMap[T]>) {
    this.handlers[type] = handler
  }
}
