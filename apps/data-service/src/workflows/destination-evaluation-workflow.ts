import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { initDatabase } from '@repo/data-ops/database';
import { addEvaluation } from '@repo/data-ops/queries/evaluations';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
	async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep) {
		// Init DB, workflow runs in different context than CF worker
		initDatabase(this.env.DB);
		const collectedData = await step.do('Collect rendered destination page data', async () => {
			return collectDestinationInfo(this.env, event.payload.destinationUrl);
		});

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

		// Backup HTML and body text in CF R2 storage
		await step.do('Backup destination HTML in R2', async () => {
			const accountId = event.payload.accountId;
			const r2PathHtml = `evaluations/${accountId}/html/${evaluationId}`;
			const r2PathBodyText = `evaluations/${accountId}/body-text/${evaluationId}`;
			await this.env.BUCKET.put(r2PathHtml, collectedData.html);
			await this.env.BUCKET.put(r2PathBodyText, collectedData.bodyText);
		});
	}
}
