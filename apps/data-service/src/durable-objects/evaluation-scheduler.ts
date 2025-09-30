import { DurableObject } from 'cloudflare:workers';
import moment from 'moment';

interface ClickData {
	accountId: string;
	linkId: string;
	destinationUrl: string;
	destinationCountryCode: string;
}

// This DO schedules out when evaluation workflow should run
export class EvaluationScheduler extends DurableObject<Env> {
	clickData: ClickData | undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.clickData = await ctx.storage.get<ClickData>('click_data');
		});
	}

	async collectLinkClick(accountId: string, linkId: string, destinationUrl: string, destinationCountryCode: string) {
		this.clickData = {
			accountId,
			linkId,
			destinationUrl,
			destinationCountryCode,
		};
		await this.ctx.storage.put('click_data', this.clickData);

		// Check if there is any alarm set for this DO
		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			const oneDay = moment().add(24, 'hours').valueOf();
			await this.ctx.storage.setAlarm(oneDay);
		}
	}

	async alarm() {
		console.log('Evaluation scheduler alarm triggered');

		const clickData = this.clickData;

		// In production, this should never happen, if it does,
		// we should send this to some error tracking service
		// like Posthog, Sentry, etc.
		if (!clickData) throw new Error('Click data not set');

		await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
			params: {
				linkId: clickData.linkId,
				accountId: clickData.accountId,
				destinationUrl: clickData.destinationUrl,
			},
		});
	}
}
