// ============================================================
// Fairway — Core TypeScript Types
// ============================================================

export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green' | 'recovery' | 'penalty'

export type SGCategory = 'ott' | 'app' | 'arg' | 'putt'

export type TeeColor = 'Black' | 'Blue' | 'White' | 'Gold' | 'Red'

export interface TeeOption {
  color: TeeColor
  label: string
  estimatedRating: number
  estimatedSlope: number
}

// ============================================================
// Database row types (match supabase schema exactly)
// ============================================================

export interface Profile {
  id: string
  display_name: string | null
  handicap_index: number
  home_course: string | null
  created_at: string
}

export interface Round {
  id: string
  user_id: string
  date: string
  course_name: string
  tees: string | null
  weather: string | null
  score: number | null
  par: number
  putts: number | null
  gir: number | null
  fir_made: number | null
  fir_total: number | null
  sg_ott: number | null
  sg_app: number | null
  sg_arg: number | null
  sg_putt: number | null
  penalties: number
  sand_saves: number
  three_putts: number
  one_putts: number
  course_rating: number | null
  slope_rating: number | null
  handicap_diff: number | null
  notes: string | null
  mental_score: number | null
  energy_score: number | null
  created_at: string
}

export interface Hole {
  id: string
  round_id: string
  hole_number: number
  par: number
  score: number | null
  putts: number | null
  gir: boolean
  fir: boolean | null
  sg_total: number | null
}

export interface Shot {
  id: string
  round_id: string
  hole_number: number
  shot_number: number
  club: string | null
  start_lie: Lie
  end_lie: Lie | null
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  dist_yards: number | null
  dist_to_flag_before: number | null
  dist_to_flag_after: number | null
  sg: number | null
  sg_category: SGCategory | null
  is_holed: boolean
}

export interface BagClub {
  id: string
  user_id: string
  club_name: string
  avg_distance: number | null
  carry_distance: number | null
  max_distance: number | null
  sort_order: number
}

// ============================================================
// Strokes Gained
// ============================================================

export interface SGBaselines {
  tee: [number, number][]     // [distance_yards, expected_strokes]
  fairway: [number, number][]
  rough: [number, number][]
  sand: [number, number][]
  green: [number, number][]   // [distance_feet, expected_strokes]
}

// ============================================================
// Dashboard / Analytics
// ============================================================

export type BenchmarkKey = 'scratch' | '5hcp' | '10hcp' | '15hcp' | '20hcp'

export interface BenchmarkValues {
  label: string
  sg_ott: number
  sg_app: number
  sg_arg: number
  sg_putt: number
  scoringAvg: number
  gir: number
  fir: number
  puttsPerRound: number
}

export interface DashboardStats {
  scoringAvg: number | null
  bestScore: number | null
  girPct: number | null
  firPct: number | null
  puttsPerRound: number | null
  scramblingPct: number | null
  threePuttAvg: number | null
  penaltiesAvg: number | null
  sgOtt: number | null
  sgApp: number | null
  sgArg: number | null
  sgPutt: number | null
  roundsPlayed: number
}

// ============================================================
// Play page — in-progress round state
// ============================================================

export interface ActiveRound {
  courseId: string | null
  courseName: string
  tees: TeeColor
  courseRating: number
  slopeRating: number
  date: string
  holes: ActiveHole[]
  currentHole: number
  savedRoundId: string | null
}

export interface ActiveHole {
  holeNumber: number
  par: number
  flagLat: number | null
  flagLng: number | null
  shots: ActiveShot[]
}

export interface ActiveShot {
  shotNumber: number
  club: string | null
  startLie: Lie
  endLie: Lie | null
  startLat: number
  startLng: number
  targetLat: number | null   // where the player AIMED
  targetLng: number | null
  endLat: number | null      // where the ball ACTUALLY landed
  endLng: number | null
  distToFlagBefore: number | null
  distToFlagAfter: number | null
  dispersionYards: number | null  // distance from target to actual landing
  sg: number | null
  sgCategory: SGCategory | null
  isHoled: boolean
}

// ============================================================
// Course search
// ============================================================

export interface CourseSearchResult {
  id: string
  name: string
  lat: number
  lng: number
  city?: string
  state?: string
}
