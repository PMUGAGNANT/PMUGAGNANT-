export type Lisibilite = "LISIBLE" | "COMPLEXE" | "LOTERIE";
export type PredictionDecision = "VALIDE" | "SURVEILLANCE" | "REJET";
export type ScoreStage = "MATIN" | "T10" | "RESULTAT";
export type SignalVariation =
  | "FORTE_BAISSE"
  | "BAISSE"
  | "STABLE"
  | "HAUSSE"
  | "FORTE_HAUSSE"
  | "DONNEE_INDISPONIBLE";

export interface RaceSummary {
  dateStr: string;
  reunion: number;
  course: number;
  hippodrome: string;
  pays: string;
  nomCourse: string;
  heureDepart: string;
  discipline: string;
  estTrot: boolean;
  estPlat: boolean;
  estQuinte: boolean;
  allocation: number;
  distance: number;
  nombrePartants: number;
  meteo?: string | null;
  terrain?: string | null;
}

export interface Participant {
  numPmu: number;
  nom: string;
  driver: string;
  entraineur: string;
  jockey: string;
  age: number;
  sexe: string;
  cote: number | null;
  musique: string;
  nombreCourses: number;
  nombreVictoires: number;
  nombrePlaces: number;
  gainCarriere: number;
  nombreSuiveurs: number;
  ordreArrivee: number | null;
  statut: string;
  placeCorde?: number | null;
  stalle?: number | null;
  poids?: number | null;
  ferrure?: string | null;
  nonPartant?: boolean;
  coteMatin?: number | null;
  coteDepart?: number | null;
  variationCote?: number | null;
  signalVariation?: SignalVariation | null;
  formeRecenteAmelioree?: boolean;
  tauxFaute?: number | null;
  terrainPreference?: string | null;
  meteoPreference?: string | null;
  jockeyWinRate?: number | null;
  jockeyRecentForm?: number | null;
  trainerTrackWinRate?: number | null;
  distanceWinRate?: number | null;
  distancePlaceRate?: number | null;
  trackWinRate?: number | null;
  trackPlaceRate?: number | null;
  terrainWinRate?: number | null;
  terrainPlaceRate?: number | null;
  daysSinceLastRun?: number | null;
}

export interface MusicStats {
  recentPositions: number[];
  nbVictoires: number;
  nbPodiums: number;
  nbDQ: number;
  nbAbandons: number;
  fiabilite: number;
  averagePosition: number;
  serie: number;
  trend: number;
  ratioForme: number;
}

export interface RunnerSignals {
  forme: number;
  regularite: number;
  victoire: number;
  podium: number;
  humain: number;
  entraineur: number;
  jockeyForme: number;
  trainerTrack: number;
  marche: number;
  gains: number;
  popularite: number;
  stalle: number;
  poids: number;
  distance: number;
  terrain: number;
  meteo: number;
  hippodrome: number;
  ageSexe: number;
  repos: number;
  valueIntrinseque: number;
  risque: number;
  faute: number;
}

export interface RunnerPredictionMetrics {
  scoreCheval: number;
  qualite: number;
  confiance: number;
  scoreFinalPari: number;
  probaEstimee: number;
  probabiliteImplicite: number;
  probabiliteValueSeuil: number;
  valueCalculee: number;
  valueEffective: number;
  top3Potential: number;
  top5Potential: number;
  objective: "GAGNE" | "PODIUM" | "TOP5" | "SPECULATIF";
  outsider: boolean;
  valueBet: boolean;
  marketEdge: number;
  kellyFraction: number;
  bankrollPct: number;
  miseBase100: number;
  action: "MISER" | "NE PAS MISER";
  topFacteurs: string[];
  decision: PredictionDecision;
  typePariConseille: "GAGNANT" | "PLACE";
  miseConseillee: number;
}

export interface ScoredParticipant extends Participant {
  score: number;
  scoreAlgo: number;
  estTocard: boolean;
  musicStats: MusicStats | null;
  signaux: RunnerSignals;
  prediction: RunnerPredictionMetrics;
}

export interface PredictedOdds {
  coteMatin: number | null;
  coteEstimee: number | null;
  variation: string;
  variationPercent: number | null;
  tendance: "BAISSE_FORTE" | "BAISSE" | "HAUSSE" | "STABLE";
}

export interface ValueAnalysis {
  probabilite: number;
  probabiliteImplicite?: number;
  probabiliteValueSeuil?: number;
  coteJuste: number;
  cotePMU: number;
  valueIndex: number;
  valueBrute: number;
  valueEffective: number;
  valueBet?: boolean;
  bankrollPct?: number;
  kellyFraction?: number;
  label: string;
  emoji: string;
  miseConseillee: number;
}

export interface FavoriteSolidity {
  score: number;
  estFragile: boolean;
  alertes: string[];
  pointsPositifs: string[];
  ecartScore: number;
}

export interface Recommendation {
  decision: string;
  emoji: string;
  vautLeCoup: boolean;
  raisonnement: string[];
}

export interface ConfidenceScore {
  score: number;
  niveau: { label: string; emoji: string };
  facteurs: string[];
}

export interface StrategicProfiles {
  beton: ScoredParticipant | null;
  pepite: ScoredParticipant | null;
  sniper: ScoredParticipant | null;
  lisibilite: Lisibilite;
}

export interface SelectionResult {
  type: "BETON" | "PEPITE" | "SNIPER" | null;
  cheval: ScoredParticipant | null;
  confiance: number;
  decision: string;
  mise: { type: string; unites: number };
}

export interface RacePredictionSummary {
  scoreLisibilite: number;
  coefficientLisibilite: number;
  lisibilite: Lisibilite;
  decisionCourse: PredictionDecision;
  outsiderAutorise: boolean;
  journeeSignal?: DaySignal;
}

export interface CompositeBetPlan {
  type: "SIMPLE_GAGNANT" | "COUPLE" | "TRIO" | "QUINTE" | "MULTI";
  chevaux: number[];
  confiance: number;
  eligible: boolean;
  raison: string;
}

export interface BettingPlan {
  bankrollBase: number;
  simpleGagnant: CompositeBetPlan | null;
  couple: CompositeBetPlan | null;
  trio: CompositeBetPlan | null;
  quinte: CompositeBetPlan | null;
  multi: CompositeBetPlan | null;
}

export interface DaySignal {
  label: "JOURNEE_FAVORABLE" | "JOURNEE_NEUTRE" | "JOURNEE_DEFAVORABLE";
  score: number;
  raisons: string[];
}

export interface RaceAnalysis {
  courseInfo: RaceSummary;
  participants: number;
  ranking: ScoredParticipant[];
  top5: ScoredParticipant[];
  favori: ScoredParticipant | null;
  pepiteDuJour: ScoredParticipant | null;
  soliditeFavori: FavoriteSolidity | null;
  recommandation: Recommendation | null;
  scoreConfiance: ConfidenceScore | null;
  predictionsCotes: Record<number, PredictedOdds>;
  profils: StrategicProfiles;
  valueTop5: Record<number, ValueAnalysis>;
  prediction: RacePredictionSummary;
  bettingPlan: BettingPlan;
  alertes: string[];
}

export interface AlgoParameters {
  validation: {
    confianceMin: number;
    qualiteMin: number;
    lisibilitesAcceptees: Lisibilite[];
  };
  lisibilite: {
    coefficients: Record<Lisibilite, number>;
    valueCoefficients: Record<Lisibilite, number>;
    thresholds: {
      readableMin: number;
      complexMin: number;
    };
  };
  value: {
    maxCap: number;
    confidenceMin: number;
  };
  outsiders: {
    coteMin: number;
    variationMinPct: number;
    miseReductionFactor: number;
    maxPerReunion: number;
  };
  preRace: {
    strongDropPct: number;
    negativeRisePct: number;
    strongBonus: number;
    riseMalus: number;
    retractDecisionBelowConfidence: number;
  };
  fautifs: {
    warningRate: number;
    rejectRate: number;
    warningMalus: number;
  };
  probabilityCalibration: {
    bins: Array<{
      min: number;
      max: number;
      multiplier: number;
      sampleSize?: number;
    }>;
  };
}

export interface LiveCourseSnapshot {
  coteActuelleByHorse: Record<number, number | null>;
  nonPartants: number[];
  ferrureChanges: Record<number, string>;
}

export interface PredictionRow {
  id?: string;
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  cheval_num: number;
  cheval_nom: string;
  score_cheval: number;
  score_final_pari?: number | null;
  coefficient_lisibilite?: number | null;
  confiance: number;
  qualite: number;
  lisibilite: Lisibilite;
  value: number | null;
  cote_matin: number | null;
  cote_depart: number | null;
  variation_cote: number | null;
  signal_variation: SignalVariation | null;
  ferrure_ref?: string | null;
  ferrure_t10?: string | null;
  non_partant?: boolean | null;
  decision: PredictionDecision;
  pari_conseille?: "GAGNANT" | "PLACE" | null;
  outsider?: boolean | null;
  mise_simulee: number;
  resultat_place: boolean | null;
  resultat_gagnant: boolean | null;
  rapport_place: number | null;
  rapport_gagnant: number | null;
  gain_simule: number | null;
  stage?: ScoreStage | null;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyReportRow {
  id?: string;
  week_start: string;
  week_end: string;
  roi_total: number;
  roi_by_decision: Record<string, number>;
  roi_by_lisibilite: Record<string, number>;
  roi_by_hippodrome: Record<string, number>;
  roi_by_discipline?: Record<string, number>;
  roi_by_confiance?: Record<string, number>;
  roi_by_pari?: Record<string, number>;
  sample_size: number;
  recommendations: string[];
  created_at?: string;
}

export interface ParamHistoryRow {
  id?: string;
  parameter_key: string;
  previous_value: string;
  next_value: string;
  reason: string;
  created_at?: string;
}

export interface ChevalFaultRow {
  id?: string;
  cheval_nom: string;
  taux_faute: number;
  dq_count: number;
  sample_size: number;
  updated_at?: string;
}

export interface CourseRecordRow {
  id?: string;
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  nom_course: string;
  heure_depart: string;
  discipline: string;
  allocation: number;
  distance: number;
  nombre_partants: number;
  terrain?: string | null;
  meteo?: string | null;
  lisibilite: Lisibilite | null;
  score_lisibilite: number | null;
  coefficient_lisibilite: number | null;
  decision_course: PredictionDecision | null;
  updated_at?: string;
}

export type RaceStatus = "upcoming" | "prono_available" | "live" | "finished";

export interface BacktestBetTypeResult {
  betType: string;
  betsPlaced: number;
  winningBets: number;
  totalStake: number;
  totalGain: number;
  profit: number;
  roi: number;
  hitRate: number;
}

export interface BacktestCalibrationBin {
  label: string;
  sampleSize: number;
  averagePredicted: number;
  actualWinRate: number;
  delta: number;
}

export interface BacktestSummary {
  startDate: string;
  endDate: string;
  days: number;
  racesAnalyzed: number;
  racesSkipped: number;
  totalBets: number;
  totalStake: number;
  totalGain: number;
  totalProfit: number;
  roi: number;
  summarySentence: string;
  byBetType: BacktestBetTypeResult[];
  calibration: BacktestCalibrationBin[];
}
