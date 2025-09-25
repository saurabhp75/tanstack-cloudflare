import { WorkerEntrypoint } from 'cloudflare:workers';
import { App } from './hono/app';

export default class DataService extends WorkerEntrypoint<Env> {
	fetch(request: Request) {
		// Forward the request to the Hono app
		return App.fetch(request, this.env, this.ctx);
	}
}
