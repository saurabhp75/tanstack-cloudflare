interface DestinationStatusEvaluationParams {
	linkId: string;
	destinationUrl: string;
	accountId: string;
}

// override DESTINATION_EVALUATION_WORKFLOW so that workflow is typed:
interface Env extends Cloudflare.Env {
	DESTINATION_EVALUATION_WORKFLOW: Workflow<DestinationStatusEvaluationParams>;
}
