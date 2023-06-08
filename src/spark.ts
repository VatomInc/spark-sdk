import Koa from 'koa'
import route from 'koa-route'
import bodyParser from 'koa-bodyparser'

type Facade = {
  id: string
  types?: string[]
  events?: string[]
}

type Control = {
  id: string
}

type Descriptor = {
  plugin_id: string
  facades: Facade[]
  controls: Control[]
}

type EventHandler<T extends Array<any>> = (payload: T) => Promise<void> | void

export default class Spark<EventMap extends Record<string, any>> {
  private app = new Koa()
  private handlers: {
    [K in keyof EventMap]?: EventHandler<EventMap[K]>
  } = {}

  private port = 3000
  private descriptor: Descriptor
  private clientId: string
  private clientSecret: string

  // TODO - the the SDK will receive messages from the server and must validate that the requests are valid based on the signature in the header

  // 1) The client must call an API on the server to retrieve the signing secret - using the clientId and clientSecret
  // 2) Extract the timestamp and signatures from the header (Vatom-Signature)
  // 3) Prepare the signed_payload string
  // 4) Determine the expected signature
  // 5) Compare the signatures

  // https://stripe.com/docs/webhooks/signatures#compare-signatures

  constructor(descriptor: any, clientId: string, clientSecret: string) {
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
        // TODO: Validate Signature
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
