import { DurableObject } from 'cloudflare:workers';

// This DO schedules out when evaluation workflow should run
export class EvaluationScheduler extends DurableObject {
	count: number = 0;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.count = (await ctx.storage.get('count')) || this.count;
		});
	}

	async increment() {
		this.count++;
		await this.ctx.storage.put('count', this.count);
	}

	async getCount() {
		return this.count;
	}
}
