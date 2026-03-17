/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly RESEND_API_KEY: string;
  readonly SESSION_SECRET: string;
  readonly DISCORD_INGEST_KEY: string;
  readonly CRON_SECRET: string;
  readonly VAPID_PRIVATE_KEY: string;
  readonly VAPID_PUBLIC_KEY: string;
  readonly VAPID_SUBJECT: string;
  readonly EMAIL_FROM?: string;
}

