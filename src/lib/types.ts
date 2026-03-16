export interface RaceSummary {
  dateStr: string;
  reunion: number;
  course: number;
  hippodrome: string;
  pays: string;
  nomCourse: string;
  heureDepart: string; // ISO string or "HH:mm"
  discipline: string; // TROT_ATTELE, TROT_MONTE, PLAT, OBSTACLE
  estTrot: boolean;
  estPlat: boolean;
  estQuinte: boolean;
  allocation: number;
  distance: number;
  nombrePartants: number;
}

export interface Participant {
  numPmu: number;
  nom: string;
  placeCorde: number | null;
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

export interface ScoredParticipant extends Participant {
  score: number;
  scoreAlgo: number;
  estTocard: boolean;
  musicStats: MusicStats | null;
}

export interface PredictedOdds {
  coteMatin: number | null;
  coteEstimee: number | null;
  variation: string;
  tendance: 'BAISSE_FORTE' | 'BAISSE' | 'HAUSSE' | 'STABLE';
}

export interface ValueAnalysis {
  probabilite: number;
  coteJuste: number;
  cotePMU: number;
  valueIndex: number;
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

export type BetRecommendationType =
  | 'SIMPLE_GAGNANT'
  | 'COUPLE_PLACE'
  | 'COUPLE_GAGNANT';

export interface BetRecommendationHorse {
  numPmu: number;
  nom: string;
  placeCorde?: number | null;
}

export interface BetRecommendation {
  type: BetRecommendationType;
  label: string;
  emoji: string;
  chevaux: BetRecommendationHorse[];
  surete: number;
  sureteLabel: string;
  miseConseillee: number;
  coteEstimee: number | null;
  pourquoi: string[];
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
  lisibilite: 'LISIBLE' | 'COMPLEXE' | 'LOTERIE';
}

export interface RaceAnalysis {
  courseInfo: RaceSummary;
  participants: number;
  top5: ScoredParticipant[];
  favori: ScoredParticipant | null;
  soliditeFavori: FavoriteSolidity | null;
  recommandation: Recommendation | null;
  parisRecommandes: BetRecommendation[];
  scoreConfiance: ConfidenceScore | null;
  predictionsCotes: Record<number, PredictedOdds>;
  profils: StrategicProfiles;
  valueTop5: Record<number, ValueAnalysis>;
}

export interface SelectionResult {
  type: 'BETON' | 'PEPITE' | 'SNIPER' | null;
  cheval: ScoredParticipant | null;
  confiance: number;
  decision: string;
  mise: { type: string; unites: number };
}

export type RaceStatus = 'upcoming' | 'prono_available' | 'live' | 'finished';
