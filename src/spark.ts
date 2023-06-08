import Koa from "koa";
import route from "koa-route";
import bodyParser from "koa-bodyparser";

type Facade = {
  id: string;
  types?: string[];
  events?: string[];
};

type Control = {
  id: string;
};

type Descriptor = {
  plugin_id: string;
  facades: Facade[];
  controls: Control[];
};

type EventHandler<T extends Array<any>> = (payload: T) => void;

export default class Spark<EventMap extends Record<string, any>> {
  private app = new Koa();
  private handlers: {
    [K in keyof EventMap]?: Set<EventHandler<EventMap[K]>>;
  } = {};

  private port = 3000;
  private descriptor: Descriptor;
  private clientId: string;
  private clientSecret: string;

  // TODO - the the SDK will receive messages from the server and must validate that the requests are valid based on the signature in the header

  // 1) The client must call an API on the server to retrieve the signing secret - using the clientId and clientSecret
  // 2) Extract the timestamp and signatures from the header (Vatom-Signature)
  // 3) Prepare the signed_payload string
  // 4) Determine the expected signature
  // 5) Compare the signatures

  // https://stripe.com/docs/webhooks/signatures#compare-signatures

  constructor(descriptor: any, clientId: string, clientSecret: string) {
    this.descriptor = descriptor;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  start() {
    this.app.use(bodyParser());

    this.app.use(
      route.get("/plugin.json", (ctx) => {
        ctx.body = this.descriptor;
      })
    );

    this.app.use(
      route.post("/events", async (ctx) => {
        // ctx.body = await handlers[ctx.request.body.type](ctx.request.body);
        // TODO: Validate Signature
        // ctx.body = await this.handlers.get(ctx.request.body.type)(ctx.request.body);
        // @ts-expect-error we need to to a similar thing to koa-route to get the type of the body once we add signature validation
        const type = ctx.request.body?.type as keyof EventMap;
        // needs review
        const payload = ctx.request.body as EventMap[typeof type];
        const handlers = this.handlers[type];
        if (handlers) {
          for (const handler of handlers) {
            handler(payload);
          }
        }
      })
    );

    this.app.listen(this.port);
    console.info(`Spark started on port: ${this.port}`);
  }

  on<T extends keyof EventMap>(type: T, handler: EventHandler<EventMap[T]>) {
    const handlers = this.handlers[type] || new Set();
    handlers.add(handler);
    this.handlers[type] = handlers;
  }
}
