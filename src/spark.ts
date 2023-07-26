import Koa from 'koa'
import route from 'koa-route'
import bodyParser from 'koa-bodyparser'
import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';

const crypto = require("crypto").webcrypto;

type MessageFacade = {
  id: string
  actions?: string[]
}

type ModalFacade = {
  event: string
  name: string
  message_type: string
}

type BadgeFacade = {
  id: string
}

type Filter = {
  name: string
  message_type: string
}

type Control = {
  id: string
}

type Descriptor = {
  namespace: string
  plugin_id: string
  facades: {
    message: MessageFacade[],
    modal: ModalFacade[],
    badge: BadgeFacade[]
  }
  filters: Filter[]
  controls: Control[]
}

type EventHandler<T extends Array<any>> = (payload: T) => Promise<any> | any

async function verifyVatomSignature(bodyString: string, signature: string, signatureTs: number, secret?: string) {

  if (!secret) return

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
    new TextEncoder().encode(signatureTs + ":" + bodyString),
  )

  if (!valid) throw new Error("signature invalid")

  if (Date.now() - signatureTs > (600_000 /* 10 min in ms */)) {
    throw new Error("signature timestamp expired")
  }
}

const {
	OIDC_API_BASE,
} = process.env

const ax = axios.create({
	baseURL: OIDC_API_BASE || "https://id.vatom.com"
});

const tokenCache = new NodeCache({ stdTTL: 500, checkperiod: 20 });
async function getClientCredentialsToken(clientId: string, clientSecret: string, scope: string): Promise<any> {
	
	const cacheKey = `${clientId}.${clientSecret}.${scope}`;
	let fromCache = tokenCache.get<any>(cacheKey);

	if (fromCache) {
		return fromCache;
	}

	const { data } = await ax.post("/token", new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: clientId!,
		scope,
	}), {
		auth: { username: clientId!, password: clientSecret! },
	});

	tokenCache.set(cacheKey, data);
	return data;
}

export default class Spark<EventMap extends Record<string, any>> {
  private app = new Koa()
  private handlers: {
    [K in keyof EventMap]?: EventHandler<EventMap[K]>
  } = {}

  private port = 3000
  private descriptor: Descriptor
  private clientId: string
  private clientSecret: string
  private ax: AxiosInstance

  constructor(descriptor: Descriptor, clientId: string, clientSecret: string, private signingSecret?: string) {
    this.descriptor = descriptor
    this.clientId = clientId
    this.clientSecret = clientSecret

    this.ax = axios.create({ 
      baseURL: process.env.BUSINESSES_API_BASE || "https://businesses.api.vatominc.com"
    });
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
        const signatureTs = Number.parseInt(ctx.get("x-signature-timestamp"))

        try {
          await verifyVatomSignature(bodyString, signature, signatureTs, this.signingSecret)
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
        } else {
          ctx.status = 204
        }
      })
    )

    this.app.listen(this.port)
    console.info(`Spark started on port: ${this.port}`)
  }

  on<T extends keyof EventMap>(type: T, handler: EventHandler<EventMap[T]>) {
    this.handlers[type] = handler
  }

  async sendRoomEvent(roomId: string, eventType: string, data: any) {

    const { access_token } = await getClientCredentialsToken(this.clientId, this.clientSecret, 'profile')
    this.ax.post(`/_matrix/client/v3/rooms/${roomId}/send/${eventType}`, data, {
      headers: {
        Authorization: `Bearer ${access_token}`
      } 
    })
  }

  async updateRoomState(roomId: string, eventType: string, stateKey: string, data: any) {
    
    const { access_token } = await getClientCredentialsToken(this.clientId, this.clientSecret, 'profile')
    this.ax.put(`/_matrix/client/v3/rooms/${roomId}/state/${eventType}/${stateKey}`, data, {
      headers: {
        Authorization: `Bearer ${access_token}`
      } 
    })
  }

  async getRoomEvent(roomId: string, eventId: string) {
    
    const { access_token } = await getClientCredentialsToken(this.clientId, this.clientSecret, 'profile')
    const { data, status} = await this.ax.get(`/_matrix/client/v3/rooms/${roomId}/event/${eventId}`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      } 
    })

    return data
  }
}