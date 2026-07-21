import { Redis } from "@upstash/redis";

/**
 * Works with the "Upstash for Redis" integration from the Vercel Marketplace
 * (Vercel Dashboard → Storage → Create Database → Redis). That integration
 * automatically injects KV_REST_API_URL / KV_REST_API_TOKEN into your
 * project's environment variables — nothing to copy/paste by hand.
 *
 * It also works with a standalone Upstash account using the
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN variable names.
 */
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let client: Redis | null = null;

export function isKvConfigured() {
  return Boolean(url && token);
}

export function getKv(): Redis {
  if (!isKvConfigured()) {
    throw new Error(
      "No Redis database is connected. In Vercel: Dashboard → Storage → Create Database → " +
        "Upstash Redis → Connect to this project, then redeploy. See DEPLOYMENT_FIX_GUIDE.md."
    );
  }
  if (!client) {
    client = new Redis({ url: url as string, token: token as string });
  }
  return client;
}
