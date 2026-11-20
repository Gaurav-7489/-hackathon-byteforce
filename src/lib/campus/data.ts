import type { CompanionProfile, CrowdZone, Opportunity, VenueProfile } from './types'

/**
 * Bundled, typed demo data for the campus layer. Every accessibility, comfort,
 * obstruction and safety attribute is listed explicitly per venue (as an
 * organizer would supply it). Nothing is inferred from a seat's position.
 *
 * Seat grid shared by all venues (see lib/api/mock/data.ts): rows A–K (no I),
 * seats 1–20; left block 1–5 (cols 0–4), centre 6–15 (cols 6–15), right 16–20
 * (cols 17–21).
 */

const DEMO_SAFETY = [
  'Follow stewards in hi-vis vests and the illuminated green exit signs.',
  'Do not use lifts during an evacuation unless a steward directs you to an evacuation lift.',
  'Leave bags behind. Walk, do not run, and keep aisles clear.',
  'Go to the assembly point and wait for a roll call from the organizer.',
]

export const VENUES: VenueProfile[] = [
  {
    name: 'Open Air Theatre',
    buildingId: 'oat',
    wheelchairSpaces: ['K5', 'K16'],
    companionSeats: ['K4', 'K17'],
    stepFreeRows: ['J', 'K'],
    exits: [
      { id: 'oat-rl', label: 'Rear-left ramp', rowIndex: 9, col: -1, stepFree: true },
      { id: 'oat-rr', label: 'Rear-right ramp', rowIndex: 9, col: 22, stepFree: true },
      { id: 'oat-fl', label: 'Front-left steps', rowIndex: 0, col: -1, stepFree: false },
      { id: 'oat-fr', label: 'Front-right steps', rowIndex: 0, col: 22, stepFree: false },
    ],
    quietZones: [{ label: 'Lawn-edge low-stimulation rows', rows: ['H', 'J', 'K'], sections: ['left', 'right'] }],
    speakers: [{ rowIndex: 0, col: 3 }, { rowIndex: 0, col: 18 }],
    obstructions: [{ seatIds: ['K10', 'K11'], note: 'The sound desk may hide the lower edge of the stage.' }],
    accessibleRestroom: { distanceM: 60, note: 'Step-free restroom beside the rear-left ramp.' },
    gates: ['OAT Gate 1', 'OAT Gate 2'],
    assemblyPoint: 'Sports field, north edge',
    safetyInstructions: DEMO_SAFETY,
    verifiedPlan: false,
    stageDistanceM: 6, rowDepthM: 1.1, seatWidthM: 0.55, rakeM: 0.45,
  },
  {
    name: 'Seminar Hall B',
    buildingId: 'academic',
    wheelchairSpaces: ['A1', 'A20'],
    companionSeats: ['A2', 'A19'],
    stepFreeRows: ['A', 'B'],
    exits: [
      { id: 'sem-fl', label: 'Front-left door (level)', rowIndex: 0, col: -1, stepFree: true },
      { id: 'sem-fr', label: 'Front-right door (level)', rowIndex: 0, col: 22, stepFree: true },
      { id: 'sem-r', label: 'Rear door (stairs)', rowIndex: 9, col: 11, stepFree: false },
    ],
    quietZones: [{ label: 'Rear-left reading rows', rows: ['F', 'G', 'H', 'J', 'K'], sections: ['left'] }],
    speakers: [{ rowIndex: 0, col: 0 }, { rowIndex: 0, col: 21 }],
    obstructions: [{ seatIds: ['E5', 'F5'], note: 'A structural pillar partly blocks the left of the stage.' }],
    accessibleRestroom: { distanceM: 25, note: 'Accessible restroom across the corridor from the front-left door.' },
    gates: ['Academic Block Door A', 'Academic Block Door B'],
    assemblyPoint: 'Library lawn',
    safetyInstructions: DEMO_SAFETY,
    verifiedPlan: false,
    stageDistanceM: 3, rowDepthM: 0.95, seatWidthM: 0.5, rakeM: 0.25,
  },
  {
    name: 'Convocation Hall',
    buildingId: 'convocation',
    wheelchairSpaces: ['K6', 'K15'],
    companionSeats: ['K7', 'K14'],
    stepFreeRows: ['J', 'K'],
    exits: [
      { id: 'con-rl', label: 'Rear-left foyer (level)', rowIndex: 9, col: -1, stepFree: true },
      { id: 'con-rr', label: 'Rear-right foyer (level)', rowIndex: 9, col: 22, stepFree: true },
      { id: 'con-ml', label: 'Mid-left stairs', rowIndex: 5, col: -1, stepFree: false },
      { id: 'con-mr', label: 'Mid-right stairs', rowIndex: 5, col: 22, stepFree: false },
    ],
    quietZones: [{ label: 'Rear-right calm rows', rows: ['J', 'K'], sections: ['right'] }],
    speakers: [{ rowIndex: 0, col: 2 }, { rowIndex: 0, col: 19 }, { rowIndex: 5, col: -1 }, { rowIndex: 5, col: 22 }],
    obstructions: [{ seatIds: ['H8', 'H9'], note: 'A lighting truss may cut off the top of the LED wall.' }],
    accessibleRestroom: { distanceM: 40, note: 'Accessible restroom in the rear foyer.' },
    gates: ['Convocation North Door', 'Convocation East Door'],
    assemblyPoint: 'Central plaza fountain',
    safetyInstructions: DEMO_SAFETY,
    verifiedPlan: false,
    stageDistanceM: 5, rowDepthM: 1.0, seatWidthM: 0.52, rakeM: 0.35,
  },
  {
    name: 'Main Auditorium',
    buildingId: 'auditorium',
    wheelchairSpaces: ['E1', 'E20'],
    companionSeats: ['E2', 'E19'],
    stepFreeRows: ['D', 'E'],
    exits: [
      { id: 'aud-ml', label: 'Mid-left door (level)', rowIndex: 4, col: -1, stepFree: true },
      { id: 'aud-mr', label: 'Mid-right door (level)', rowIndex: 4, col: 22, stepFree: true },
      { id: 'aud-rl', label: 'Rear-left stairs', rowIndex: 9, col: -1, stepFree: false },
      { id: 'aud-rr', label: 'Rear-right stairs', rowIndex: 9, col: 22, stepFree: false },
    ],
    quietZones: [{ label: 'Sensory-friendly block', rows: ['H', 'J', 'K'], sections: ['center'] }],
    speakers: [{ rowIndex: 0, col: 1 }, { rowIndex: 0, col: 20 }],
    obstructions: [],
    accessibleRestroom: { distanceM: 30, note: 'Accessible restroom beside the mid-left door.' },
    gates: ['Auditorium Gate A', 'Auditorium Gate B'],
    assemblyPoint: 'Central plaza fountain',
    safetyInstructions: DEMO_SAFETY,
    verifiedPlan: false,
    stageDistanceM: 4, rowDepthM: 1.0, seatWidthM: 0.52, rakeM: 0.4,
  },
]

export const venueByName = (name: string): VenueProfile | undefined => VENUES.find((v) => v.name === name)

/* ---------- Campus map (original illustration, 1000 × 640 units, 1 unit ≈ 0.8 m) ---------- */

export const METRES_PER_UNIT = 0.8

export interface Building {
  id: string
  name: string
  kind: 'venue' | 'academic' | 'service' | 'residence' | 'gate' | 'sports'
  x: number
  y: number
  w: number
  h: number
  round?: boolean
  /** Graph node used as the building's entrance. */
  door: string
  keywords: string[]
}

export const BUILDINGS: Building[] = [
  { id: 'auditorium', name: 'Main Auditorium', kind: 'venue', x: 410, y: 110, w: 200, h: 120, door: 'AUD', keywords: ['auditorium', 'hack', 'orchestra'] },
  { id: 'convocation', name: 'Convocation Hall', kind: 'venue', x: 700, y: 80, w: 210, h: 130, door: 'CON', keywords: ['convocation', 'synthwave', 'robo'] },
  { id: 'academic', name: 'Academic Block (Seminar Hall B)', kind: 'venue', x: 110, y: 320, w: 240, h: 110, door: 'SEM', keywords: ['seminar', 'academic', 'lecture', 'classes'] },
  { id: 'oat', name: 'Open Air Theatre', kind: 'venue', x: 690, y: 360, w: 170, h: 150, round: true, door: 'OAT', keywords: ['oat', 'open air', 'theatre', 'amphitheatre'] },
  { id: 'library', name: 'Central Library', kind: 'academic', x: 140, y: 110, w: 190, h: 110, door: 'LIB', keywords: ['library', 'books', 'study'] },
  { id: 'canteen', name: 'Canteen & Food Court', kind: 'service', x: 420, y: 350, w: 150, h: 80, door: 'CAN', keywords: ['food', 'canteen', 'mess', 'chai'] },
  { id: 'hostels', name: 'Hostel Cluster', kind: 'residence', x: 70, y: 500, w: 250, h: 90, door: 'HOS', keywords: ['hostel', 'residence', 'rooms'] },
  { id: 'sports', name: 'Sports Field', kind: 'sports', x: 560, y: 540, w: 220, h: 70, door: 'SPO', keywords: ['sports', 'field', 'assembly'] },
  { id: 'medical', name: 'Medical Centre', kind: 'service', x: 860, y: 520, w: 110, h: 80, door: 'MED', keywords: ['medical', 'health', 'clinic', 'first aid'] },
  { id: 'main-gate', name: 'Main Gate', kind: 'gate', x: 470, y: 605, w: 60, h: 24, door: 'MG', keywords: ['gate', 'entrance', 'bus', 'auto'] },
  { id: 'east-gate', name: 'East Gate', kind: 'gate', x: 958, y: 300, w: 30, h: 56, door: 'EG', keywords: ['gate', 'metro'] },
]

export interface MapNode { id: string; x: number; y: number; label?: string }
export interface MapEdge { a: string; b: string; stairs?: boolean; note?: string }

export const NODES: MapNode[] = [
  { id: 'MG', x: 500, y: 600, label: 'Main Gate' },
  { id: 'S1', x: 500, y: 480 },
  { id: 'PLAZA', x: 500, y: 290, label: 'Central plaza' },
  { id: 'N1', x: 500, y: 60 },
  { id: 'W1', x: 260, y: 480 },
  { id: 'W2', x: 260, y: 290 },
  { id: 'E1', x: 660, y: 290 },
  { id: 'E2', x: 660, y: 480 },
  { id: 'EG', x: 950, y: 328, label: 'East Gate' },
  { id: 'R1', x: 630, y: 250, label: 'Auditorium ramp' },
  { id: 'R2', x: 880, y: 430, label: 'OAT ramp' },
  { id: 'AUD', x: 510, y: 232, label: 'Auditorium doors' },
  { id: 'CON', x: 800, y: 212, label: 'Convocation doors' },
  { id: 'SEM', x: 260, y: 432, label: 'Academic Block door' },
  { id: 'OAT', x: 690, y: 435, label: 'OAT entrance' },
  { id: 'OATR', x: 860, y: 470, label: 'OAT rear (step-free)' },
  { id: 'LIB', x: 235, y: 222, label: 'Library door' },
  { id: 'CAN', x: 495, y: 432, label: 'Canteen' },
  { id: 'HOS', x: 260, y: 500, label: 'Hostels' },
  { id: 'SPO', x: 660, y: 540, label: 'Sports field' },
  { id: 'MED', x: 860, y: 520, label: 'Medical Centre' },
]

export const EDGES: MapEdge[] = [
  { a: 'MG', b: 'S1' },
  { a: 'S1', b: 'CAN' },
  { a: 'CAN', b: 'PLAZA' },
  { a: 'S1', b: 'W1' },
  { a: 'S1', b: 'E2' },
  { a: 'PLAZA', b: 'W2' },
  { a: 'PLAZA', b: 'E1' },
  { a: 'PLAZA', b: 'N1' },
  { a: 'W1', b: 'W2' },
  { a: 'W1', b: 'HOS' },
  { a: 'W2', b: 'SEM' },
  { a: 'W2', b: 'LIB' },
  { a: 'PLAZA', b: 'AUD', stairs: true, note: 'Front steps' },
  { a: 'E1', b: 'R1' },
  { a: 'R1', b: 'AUD', note: 'Ramp to side doors' },
  { a: 'E1', b: 'CON' },
  { a: 'E1', b: 'EG' },
  { a: 'E2', b: 'OAT', stairs: true, note: 'Amphitheatre steps' },
  { a: 'E2', b: 'SPO' },
  { a: 'E1', b: 'R2' },
  { a: 'R2', b: 'OATR', note: 'Ramp to rear terrace' },
  { a: 'OATR', b: 'OAT', note: 'Level terrace' },
  { a: 'SPO', b: 'MED' },
  { a: 'R2', b: 'MED' },
  { a: 'EG', b: 'R2' },
]

export const START_POINTS = [
  { node: 'MG', label: 'Main Gate (bus & autos)' },
  { node: 'HOS', label: 'Hostel Cluster' },
  { node: 'LIB', label: 'Central Library' },
  { node: 'EG', label: 'East Gate (metro)' },
] as const

/** Venue name → building door for routing. Step-free alternative door where one exists. */
export const VENUE_DOORS: Record<string, { door: string; stepFreeDoor: string }> = {
  'Main Auditorium': { door: 'AUD', stepFreeDoor: 'AUD' },
  'Convocation Hall': { door: 'CON', stepFreeDoor: 'CON' },
  'Seminar Hall B': { door: 'SEM', stepFreeDoor: 'SEM' },
  'Open Air Theatre': { door: 'OAT', stepFreeDoor: 'OATR' },
}

/* ---------- Crowd zones (simulated entry gates; capacity = people screened per minute) ---------- */

export const CROWD_ZONES: Record<string, CrowdZone[]> = {
  'Open Air Theatre': [
    { id: 'oat-g1', label: 'OAT Gate 1 (steps)', x: 690, y: 435, capacityPerMin: 4 },
    { id: 'oat-g2', label: 'OAT Gate 2 (ramp)', x: 860, y: 470, capacityPerMin: 3 },
  ],
  'Seminar Hall B': [
    { id: 'sem-a', label: 'Door A', x: 260, y: 432, capacityPerMin: 4 },
    { id: 'sem-b', label: 'Door B', x: 330, y: 380, capacityPerMin: 2 },
  ],
  'Convocation Hall': [
    { id: 'con-n', label: 'North Door', x: 800, y: 212, capacityPerMin: 4 },
    { id: 'con-e', label: 'East Door', x: 905, y: 150, capacityPerMin: 3 },
  ],
  'Main Auditorium': [
    { id: 'aud-a', label: 'Gate A (front)', x: 510, y: 232, capacityPerMin: 4 },
    { id: 'aud-b', label: 'Gate B (side ramp)', x: 610, y: 200, capacityPerMin: 3 },
  ],
}

/* ---------- Opportunities ---------- */

export const OPPORTUNITIES: Opportunity[] = [
  { id: 'op-hack', kind: 'competition', title: 'Hack Finals Live — audience jury', host: 'Coding Club', eventId: 'hackathon-finals', date: 'event', skills: ['Product thinking', 'Pitch evaluation'], hours: 3.5, description: 'Score 12 finalist pitches with a structured rubric used by the industry jury.' },
  { id: 'op-robo', kind: 'competition', title: 'Robo Grand Prix pit crew', host: 'Robotics Society', eventId: 'robo-grand-prix', date: 'event', skills: ['Embedded systems', 'Teamwork'], hours: 4, description: 'Watch from the pit lane and help teams log lap times and fixes.' },
  { id: 'op-figma', kind: 'workshop', title: 'Design systems in Figma', host: 'Design Club', date: '+3', skills: ['UI design', 'Design systems'], hours: 2, description: 'Hands-on: tokens, components and auto-layout for student projects.' },
  { id: 'op-resume', kind: 'workshop', title: 'Resume & LinkedIn clinic', host: 'Placement Cell', date: '+5', skills: ['Career readiness', 'Writing'], hours: 1.5, description: 'One-to-one feedback from seniors who interned at product companies.' },
  { id: 'op-ml', kind: 'workshop', title: 'ML bootcamp: from notebook to demo', host: 'AI Society', date: '+8', skills: ['Machine learning', 'Python'], hours: 3, description: 'Train a small model and ship it as a web demo in one evening.' },
  { id: 'op-talk', kind: 'talk', title: 'Alumni talk: building in public', host: 'E-Cell', date: '+11', skills: ['Entrepreneurship'], hours: 1, description: 'Founders who started in hostel rooms share what they would do again.' },
  { id: 'op-vol-usher', kind: 'volunteer', title: 'Usher team — Neon Monsoon', host: 'Music Society', eventId: 'neon-monsoon', date: 'event', skills: ['Event operations', 'Crowd care'], hours: 4, description: 'Guide students to seats and help keep exits clear. Briefing 1 hour before doors.' },
  { id: 'op-vol-access', kind: 'volunteer', title: 'Accessibility buddy — Retro Orchestra', host: 'Cultural Committee', eventId: 'retro-orchestra', date: 'event', skills: ['Inclusive events', 'Communication'], hours: 3, description: 'Meet students at the step-free entrance and help them reach accessible seating.' },
]

/* ---------- Fictional companion profiles (demo only) ---------- */

export const COMPANIONS: CompanionProfile[] = [
  { id: 'c1', handle: 'Night Owl · 12', year: '2nd year', interests: ['indie', 'music', 'poetry'], vibe: 'Arrives early, loves the front-of-house buzz', eventIds: ['neon-monsoon', 'midnight-verses'], respondsWith: 'accepted' },
  { id: 'c2', handle: 'Synth Seeker · 07', year: '3rd year', interests: ['electronic', 'music', 'tech'], vibe: 'Here for the light show', eventIds: ['synthwave-convocation', 'neon-monsoon'], respondsWith: 'accepted' },
  { id: 'c3', handle: 'Quiet Corner · 31', year: '1st year', interests: ['classical', 'poetry', 'literature'], vibe: 'Prefers calm seats and a chat after', eventIds: ['strings-at-dusk', 'midnight-verses'], respondsWith: 'accepted' },
  { id: 'c4', handle: 'Pitch Critic · 19', year: '4th year', interests: ['tech', 'startups', 'robotics'], vibe: 'Takes notes, shares takeaways', eventIds: ['hackathon-finals', 'robo-grand-prix'], respondsWith: 'declined' },
  { id: 'c5', handle: 'Laugh Track · 03', year: '2nd year', interests: ['comedy', 'music'], vibe: 'Big laugher, small talker', eventIds: ['hostel-diaries', 'retro-orchestra'], respondsWith: 'accepted' },
  { id: 'c6', handle: 'Golden Era · 22', year: 'PG', interests: ['bollywood', 'music', 'classical'], vibe: 'Knows every lyric', eventIds: ['retro-orchestra', 'strings-at-dusk'], respondsWith: 'accepted' },
  { id: 'c7', handle: 'Bot Builder · 44', year: '3rd year', interests: ['robotics', 'tech', 'electronic'], vibe: 'Will explain the combat-bot physics', eventIds: ['robo-grand-prix', 'synthwave-convocation'], respondsWith: 'accepted' },
  { id: 'c8', handle: 'Verse Weaver · 15', year: '1st year', interests: ['poetry', 'literature', 'comedy'], vibe: 'Open-mic regular', eventIds: ['midnight-verses', 'hostel-diaries'], respondsWith: 'declined' },
]

/** Interests offered in preference editors; mapped to categories in the matchmaker. */
export const INTERESTS = ['music', 'indie', 'electronic', 'classical', 'bollywood', 'poetry', 'literature', 'comedy', 'tech', 'startups', 'robotics'] as const

export const INTEREST_CATEGORY: Record<string, string[]> = {
  music: ['Music', 'Classical'],
  indie: ['Music'],
  electronic: ['Music'],
  classical: ['Classical'],
  bollywood: ['Music'],
  poetry: ['Literature'],
  literature: ['Literature'],
  comedy: ['Comedy'],
  tech: ['Tech'],
  startups: ['Tech'],
  robotics: ['Tech'],
}

/** Simulated historical cancellation rates by category (share of seats returned before the event). */
export const HIST_CANCEL_RATE: Record<string, number> = {
  Music: 0.06, Classical: 0.08, Literature: 0.1, Comedy: 0.07, Tech: 0.12,
}
