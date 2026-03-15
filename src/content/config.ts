import { defineCollection, z } from 'astro:content';

const casinosCollection = defineCollection({
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    tier: z.number(),
    rating: z.number(),
    claimUrl: z.string().url().optional(),
    streakMode: z.enum(['rolling', 'fixed']).default('rolling'),
    resetTimeLocal: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    resetTimezone: z.string().optional(),
    hasStreaks: z.boolean().default(false),
    scToUsdRatio: z.number().default(1),
    parentCompany: z.string().optional(),
    hasLiveGames: z.boolean().default(false),
    cwDirection: z.enum(['to_only', 'from_only', 'either']).optional(),
    promoBanRisk: z.string().optional(),
    hardBanRisk: z.string().optional(),
    familyBanPropagation: z.boolean().default(false),
    banConfiscatesFunds: z.boolean().default(false),
    promoBanTriggers: z.string().optional(),
    banNotes: z.string().optional(),
    playthroughMultiplier: z.number().optional(),
    playthroughNotes: z.string().optional(),
    dailyBonusDesc: z.string().optional(),
    cwNotes: z.string().optional(),
    redemptionSpeed: z.string().optional(),
    redemptionFee: z.string().optional(),
    minRedemptionUsd: z.number().optional(),
    hasAffiliateLink: z.boolean().default(false),
    affiliateLink: z.string().url().optional(),
    affiliateType: z.string().optional(),
    notes: z.string().optional(),
    lastUpdated: z.coerce.date().default(() => new Date()),
  }),
});

export const collections = {
  casinos: casinosCollection,
};
