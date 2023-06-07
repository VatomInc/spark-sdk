import Koa  from 'koa';
import route from 'koa-route';
import bodyParser from 'koa-bodyparser';

type Facade = {
    id: string,
    types?: string[],
    events?: string[]
}

type Control = {
    id: string
}

type Descriptor = {
    plugin_id: string,
    facades: Facade[],
    controls: Control[]
}

export default class Spark {
    private app = new Koa();
    private handlers: any = {};
    private port = 3000
    private descriptor: Descriptor;

    constructor(descriptor: any, clientId: string, clientSecret: string) {
        this.descriptor = descriptor
    }

    start() {
        this.app.use(bodyParser());

        this.app.use(route.get('/plugin.json', (ctx) => {
            ctx.body = this.descriptor;
        }));

        this.app.use(route.post('/events', async (ctx: any) => {
            ctx.body = await this.handlers[ctx.request.body.type](ctx.request.body);
        }));

        this.app.listen(this.port);
        console.info(`Spark started on port: ${this.port}`)
    }
    
    message(type: string, handler: any) {
        this.handlers[type] = handler;
    }
}
