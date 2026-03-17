import type { ModelWeightProfile, ModelWeightScope } from './types';

export const BUNDLED_MODEL_WEIGHT_PROFILES: Record<ModelWeightScope, ModelWeightProfile> = {
  "GLOBAL": {
    "version": "learned-global-2026-03-17",
    "scope": "GLOBAL",
    "active": true,
    "weights": {
      "formScore": 1.038,
      "serieBonus": 1.011,
      "recentVictory": 0.936,
      "formProgression": 0.976,
      "eliteScore": 0.998,
      "trainerScore": 1.031,
      "winRateBonus": 1.012,
      "ageBonus": 0.994,
      "experienceBonus": 0.969,
      "drawBonus": 1.015,
      "weightBonus": 0.996,
      "marketTrustBonus": 1.175
    },
    "metrics": {
      "samples": 57816,
      "success_rate": 24,
      "successes": 13904,
      "failures": 43912
    },
    "createdAt": "2026-03-17T17:08:38.205Z"
  },
  "PLAT": {
    "version": "learned-plat-2026-03-17",
    "scope": "PLAT",
    "active": true,
    "weights": {
      "formScore": 1.042,
      "serieBonus": 1.005,
      "recentVictory": 0.886,
      "formProgression": 0.971,
      "eliteScore": 1,
      "trainerScore": 1.055,
      "winRateBonus": 1.015,
      "ageBonus": 0.998,
      "experienceBonus": 0.976,
      "drawBonus": 1.015,
      "weightBonus": 0.99,
      "marketTrustBonus": 1.157
    },
    "metrics": {
      "samples": 26109,
      "success_rate": 24.1,
      "successes": 6290,
      "failures": 19819
    },
    "createdAt": "2026-03-17T17:08:38.263Z"
  },
  "TROT": {
    "version": "learned-trot-2026-03-17",
    "scope": "TROT",
    "active": true,
    "weights": {
      "formScore": 1.034,
      "serieBonus": 1.016,
      "recentVictory": 0.977,
      "formProgression": 0.98,
      "eliteScore": 0.996,
      "trainerScore": 1.011,
      "winRateBonus": 1.01,
      "ageBonus": 0.99,
      "experienceBonus": 0.963,
      "drawBonus": 1.015,
      "weightBonus": 1,
      "marketTrustBonus": 1.19
    },
    "metrics": {
      "samples": 31707,
      "success_rate": 24,
      "successes": 7614,
      "failures": 24093
    },
    "createdAt": "2026-03-17T17:08:38.330Z"
  }
} as const;
