import { WorkerEntrypoint } from 'cloudflare:workers';
import { App } from './hono/app';
import { initDatabase } from '@repo/data-ops/database';

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		initDatabase(env.DB);
	}

	fetch(request: Request) {
		// Forward the request to the Hono app
		return App.fetch(request, this.env, this.ctx);
	}

	async queue(batch: MessageBatch<unknown>) {
		for (const message of batch.messages) {
			console.log('Queue Event:', message.body);
		}
	}
}
