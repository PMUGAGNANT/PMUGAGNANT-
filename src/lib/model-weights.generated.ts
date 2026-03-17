import type { ModelWeightProfile, ModelWeightScope } from './types';

export const BUNDLED_MODEL_WEIGHT_PROFILES: Record<ModelWeightScope, ModelWeightProfile> = {
  "GLOBAL": {
    "version": "learned-global-2026-03-17",
    "scope": "GLOBAL",
    "active": true,
    "weights": {
      "formScore": 1.032,
      "serieBonus": 1.008,
      "recentVictory": 0.932,
      "formProgression": 0.971,
      "eliteScore": 1.001,
      "trainerScore": 1.031,
      "winRateBonus": 1.015,
      "ageBonus": 0.994,
      "experienceBonus": 0.979,
      "drawBonus": 1.016,
      "weightBonus": 0.997,
      "marketTrustBonus": 1.169
    },
    "metrics": {
      "samples": 133708,
      "success_rate": 24.2,
      "successes": 32306,
      "failures": 101402
    },
    "createdAt": "2026-03-17T21:11:50.541Z"
  },
  "PLAT": {
    "version": "learned-plat-2026-03-17",
    "scope": "PLAT",
    "active": true,
    "weights": {
      "formScore": 1.048,
      "serieBonus": 1.007,
      "recentVictory": 0.877,
      "formProgression": 0.969,
      "eliteScore": 1,
      "trainerScore": 1.066,
      "winRateBonus": 1.016,
      "ageBonus": 1,
      "experienceBonus": 0.972,
      "drawBonus": 1.019,
      "weightBonus": 0.992,
      "marketTrustBonus": 1.16
    },
    "metrics": {
      "samples": 58750,
      "success_rate": 24.3,
      "successes": 14301,
      "failures": 44449
    },
    "createdAt": "2026-03-17T21:11:50.708Z"
  },
  "TROT": {
    "version": "learned-trot-2026-03-17",
    "scope": "TROT",
    "active": true,
    "weights": {
      "formScore": 1.021,
      "serieBonus": 1.009,
      "recentVictory": 0.977,
      "formProgression": 0.972,
      "eliteScore": 1.004,
      "trainerScore": 1.004,
      "winRateBonus": 1.014,
      "ageBonus": 0.99,
      "experienceBonus": 0.985,
      "drawBonus": 1.012,
      "weightBonus": 1,
      "marketTrustBonus": 1.177
    },
    "metrics": {
      "samples": 74958,
      "success_rate": 24,
      "successes": 18005,
      "failures": 56953
    },
    "createdAt": "2026-03-17T21:11:50.936Z"
  }
} as const;
