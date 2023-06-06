import Koa  from 'koa';
import route from 'koa-route';
import path from 'path';

export default class Spark {
    private app = new Koa();
    private handlers: any = {};
    private port = 3000
    constructor(descriptor: any) {
        
    }
    start() {
        this.app.use(route.post('/events', (ctx) => {
            ctx.body = 'Hello World';
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
