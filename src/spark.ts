import Koa  from 'koa';
import route from 'koa-route';
import bodyParser from 'koa-bodyparser';
import path from 'path';

export default class Spark {
    private app = new Koa();
    private handlers: any = {};
    private port = 3000
    constructor(private descriptor: any) {
        
    }
    start() {
        this.app.use(bodyParser());

        this.app.use(route.get('/plugin.json', (ctx) => {
            ctx.body = this.descriptor;
        }));

        this.app.use(route.post('/events', async (ctx: any) => {
            ctx.body = await this.handlers[ctx.request.body.type](ctx.request.body);
        }));

        // TODO: serve the plugin.json somehow
        // this.app.use(serve(path.join(__dirname, 'public')));

        this.app.listen(this.port);
        console.info(`Spark started on port: ${this.port}`)
    }
    
    message(type: string, handler: any) {
        this.handlers[type] = handler;
    }
}
