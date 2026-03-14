import { defineCollection, z } from 'astro:content';

const casinosCollection = defineCollection({
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    tier: z.number(),
    rating: z.number(),
    washGames: z.string(),
    paAvailable: z.boolean(),
    banRisk: z.string(),
    redemptionSpeed: z.string(),
    redemptionFee: z.string().optional(),
    crossingAvailable: z.boolean().default(false),
    crossingNotes: z.string().optional(),
    playthroughMultiplier: z.number().optional(),
    platform: z.string().optional(),
    oneOhNinesStatus: z.string().optional(),
    affiliateLink: z.string().url(),
    affiliateType: z.string(),
    notes: z.string().optional(),
    lastUpdated: z.date().default(() => new Date()),
  }),
});

export const collections = {
  casinos: casinosCollection,
};
