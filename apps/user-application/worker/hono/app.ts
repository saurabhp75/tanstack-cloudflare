import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";

export const App = new Hono<{ Bindings: ServiceBindings }>();

App.all("/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createContext({ req: c.req.raw, env: c.env, workerCtx: c.executionCtx }),
  });
});

App.get("/click-socket", async (c) => {
  const headers = new Headers(c.req.raw.headers);
  // Set dummy account id for now.
  // TODO: Revisit when auth is implemented.
  headers.set("account-id", "1234567890");
  const proxiedRequest = new Request(c.req.raw, { headers });
  // Proxy the request to the data-service worker
  return c.env.BACKEND_SERVICE.fetch(proxiedRequest);
});
