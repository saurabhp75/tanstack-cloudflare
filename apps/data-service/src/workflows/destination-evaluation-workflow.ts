import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { initDatabase } from '@repo/data-ops/database';
import { addEvaluation } from '@repo/data-ops/queries/evaluations';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { v4 as uuidv4 } from 'uuid';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
	async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep) {
		// Init DB, workflow runs in different context than CF worker
		initDatabase(this.env.DB);

		const collectedData = await step.do(
			'Collect rendered destination page data',
			{
				retries: {
					limit: 1,
					delay: 1000,
				},
			},
			async () => {
				const evaluationId = uuidv4();
				const data = await collectDestinationInfo(this.env, event.payload.destinationUrl);
				const accountId = event.payload.accountId;
				const r2PathHtml = `evaluations/${accountId}/html/${evaluationId}`;
				const r2PathBodyText = `evaluations/${accountId}/body-text/${evaluationId}`;
				const r2PathScreenshot = `evaluations/${accountId}/screenshots/${evaluationId}.png`;

				// Convert base64 data URL to buffer for R2 storage
				const screenshotBase64 = data.screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
				const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');

				await this.env.BUCKET.put(r2PathHtml, data.html);
				await this.env.BUCKET.put(r2PathBodyText, data.bodyText);
				await this.env.BUCKET.put(r2PathScreenshot, screenshotBuffer);
				return {
					bodyText: data.bodyText,
					evaluationId: evaluationId,
				};
			}
		);

		// Use AI to check status of page
		const aiStatus = await step.do(
			'Use AI to check status of page',
			{
				// Don't retry as AI is expnensive
				retries: {
					limit: 0,
					delay: 0,
				},
			},
			async () => {
				return await aiDestinationChecker(this.env, collectedData.bodyText);
			}
		);

		// Save evaluation in DB
		const evaluationId = await step.do('Save evaluation in database', async () => {
			return await addEvaluation({
				linkId: event.payload.linkId,
				status: aiStatus.status,
				reason: aiStatus.statusReason,
				accountId: event.payload.accountId,
				destinationUrl: event.payload.destinationUrl,
			});
		});

	}
}
