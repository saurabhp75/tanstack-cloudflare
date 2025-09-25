import { Hono } from 'hono';

export const App = new Hono<{ Bindings: Env }>();

App.get('/:id', async (c) => {
	// Print CF specific info from the request
	console.log(JSON.stringify(c.req.raw.cf));
	// c.req.raw is the original forwarded Request object from the CF worker
	const cf = c.req.raw.cf;
	const country = cf?.country;
	const lat = cf?.latitude;
	const long = cf?.longitude;
	return c.json({
		country,
		lat,
		long,
	});
});
