/** The 20 SeatLock smart features: copy in English and Hindi. */
export type Badge = 'Priority' | 'Standout' | null

export interface FeatureMeta {
  n: string
  id: string
  badge: Badge
  effort: 'Low' | 'Medium' | 'High'
  icon: 'users' | 'clock' | 'person' | 'refresh' | 'route' | 'ticket' | 'calendar' | 'wallet' | 'mute' | 'alert' | 'sparkle' | 'eye' | 'seat' | 'grid' | 'download' | 'check' | 'cube'
  en: { title: string; problem: string; solution: string }
  hi: { title: string; line: string }
}

export const FEATURES: FeatureMeta[] = [
  { n: '01', id: 'buddy', badge: 'Priority', effort: 'Medium', icon: 'users',
    en: { title: 'Smart Buddy Seating', problem: 'Friends end up separated when booking popular events.', solution: 'Create a group invite. SeatLock finds adjacent seats within everyone’s budget and coordinates one group booking.' },
    hi: { title: 'दोस्तों के साथ सीट', line: 'ग्रुप इनवाइट बनाएँ — सबके बजट में पास-पास की सीटें एक साथ।' } },
  { n: '02', id: 'queue', badge: 'Priority', effort: 'High', icon: 'clock',
    en: { title: 'FairQueue — Anti-Bot Booking', problem: 'Popular events sell out unfairly, and students with slower internet lose seats.', solution: 'A virtual queue with server-issued tokens, per-student limits and fair allocation during peak demand.' },
    hi: { title: 'फ़ेयर क्यू — बॉट-रोधी बुकिंग', line: 'वर्चुअल कतार, टोकन और प्रति छात्र सीमा — धीमे इंटरनेट वालों के साथ भी न्याय।' } },
  { n: '03', id: 'access', badge: 'Priority', effort: 'Medium', icon: 'person',
    en: { title: 'Accessibility-First Seat Matching', problem: 'Students with mobility, sensory or accessibility needs struggle to identify suitable seats.', solution: 'Optional preferences recommend wheelchair spaces, accessible routes, low-stimulation areas and companion seating.' },
    hi: { title: 'सुलभ सीट मिलान', line: 'व्हीलचेयर, साथी सीट और शांत जगह के हिसाब से सुझाव।' } },
  { n: '04', id: 'rescue', badge: null, effort: 'Low', icon: 'refresh',
    en: { title: 'AutoRescue — Seat Recovery', problem: 'A student loses a selected seat when another booking wins.', solution: 'Instantly find comparable seats by distance, price, accessibility and group size, then ask for confirmation.' },
    hi: { title: 'ऑटो-रेस्क्यू', line: 'सीट छिन जाए तो तुरंत मिलती-जुलती सीटें।' } },
  { n: '05', id: 'nav', badge: 'Priority', effort: 'Medium', icon: 'route',
    en: { title: 'Live Campus Navigation', problem: 'Students waste time searching for halls, gates and seat sections.', solution: 'Shows the location, best entrance and a route to your seat, using indoor maps when organizers provide them.' },
    hi: { title: 'लाइव रास्ता', line: 'सबसे अच्छा गेट और आपकी सीट तक का रास्ता।' } },
  { n: '06', id: 'exchange', badge: 'Priority', effort: 'Medium', icon: 'ticket',
    en: { title: 'Verified Student Exchange', problem: 'Students with changed plans leave seats unused while others wait.', solution: 'Return bookings to an official verified waitlist instead of unverified resale.' },
    hi: { title: 'सत्यापित टिकट वापसी', line: 'टिकट आधिकारिक वेटलिस्ट को लौटाएँ — कोई ब्लैक नहीं।' } },
  { n: '07', id: 'waitlist', badge: 'Priority', effort: 'Medium', icon: 'calendar',
    en: { title: 'Predictive Waitlist', problem: 'Students keep refreshing sold-out events hoping for a cancellation.', solution: 'Join a ranked waitlist, get an expiring offer when seats free up, and see your estimated chance.' },
    hi: { title: 'स्मार्ट वेटलिस्ट', line: 'रैंक, संभावना और समय-सीमा वाला ऑफ़र — बार-बार रिफ़्रेश की ज़रूरत नहीं।' } },
  { n: '08', id: 'budget', badge: null, effort: 'Low', icon: 'wallet',
    en: { title: 'Smart Budget Planner', problem: 'Students overspend on tickets, food and transport.', solution: 'Set a total budget and see affordable options with estimated travel and food.' },
    hi: { title: 'बजट प्लानर', line: 'कुल बजट में टिकट, खाना और सफ़र।' } },
  { n: '09', id: 'quiet', badge: null, effort: 'Medium', icon: 'mute',
    en: { title: 'QuietZone Seat Finder', problem: 'Students sensitive to noise or crowds find seating hard.', solution: 'Marks quieter sections, expected sound exposure and low-crowd exits.' },
    hi: { title: 'शांत ज़ोन', line: 'कम शोर और कम भीड़ वाली सीटें।' } },
  { n: '10', id: 'exit', badge: 'Standout', effort: 'High', icon: 'alert',
    en: { title: 'Emergency SafeExit', problem: 'Attendees may not know nearby exits or what to do in an emergency.', solution: 'Verified evacuation steps and the nearest designated exit for your seat.' },
    hi: { title: 'आपात निकास', line: 'आपकी सीट से सबसे पास का निकास और निर्देश।' } },
  { n: '11', id: 'conflict', badge: 'Priority', effort: 'Low', icon: 'clock',
    en: { title: 'Campus Conflict Detector', problem: 'Students book events that clash with classes or exams.', solution: 'Compares event times with your timetable and warns before booking.' },
    hi: { title: 'टाइम-टेबल टकराव', line: 'क्लास या परीक्षा से टकराव पर पहले ही चेतावनी।' } },
  { n: '12', id: 'split', badge: null, effort: 'Low', icon: 'users',
    en: { title: 'One-Tap Group Split', problem: 'One friend pays for everyone and struggles to collect.', solution: 'Individual shares and a tracker of who has settled, without a payment integration.' },
    hi: { title: 'एक टैप में बिल बाँटें', line: 'हर दोस्त का हिस्सा और किसने चुकाया — सब एक जगह।' } },
  { n: '13', id: 'match', badge: null, effort: 'Medium', icon: 'sparkle',
    en: { title: 'AI Event Matchmaker', problem: 'Students miss events that match their interests.', solution: 'Recommendations from your interests, free time and budget, with clear reasons.' },
    hi: { title: 'AI इवेंट मैचमेकर', line: 'आपकी रुचि, समय और बजट से सुझाव — वजह के साथ।' } },
  { n: '14', id: 'view', badge: null, effort: 'Medium', icon: 'eye',
    en: { title: 'SeatView Reality Preview', problem: 'Students cannot judge how well they will see the screen.', solution: 'A calibrated preview of sightline, screen size and possible obstructions.' },
    hi: { title: 'सीट से नज़ारा', line: 'सीट से स्क्रीन कैसी दिखेगी — पहले ही देखें।' } },
  { n: '15', id: 'noshow', badge: 'Standout', effort: 'High', icon: 'seat',
    en: { title: 'No-Show Recovery Engine', problem: 'Reserved seats stay empty while people wait outside.', solution: 'After the check-in deadline, unclaimed seats go to a standby queue under organizer rules.' },
    hi: { title: 'नो-शो रिकवरी', line: 'चेक-इन के बाद खाली सीटें स्टैंडबाय वालों को।' } },
  { n: '16', id: 'crowd', badge: 'Standout', effort: 'High', icon: 'grid',
    en: { title: 'Live Crowd Heatmap', problem: 'Gates and corridors get overcrowded.', solution: 'Check-in counts highlight busy areas and suggest a quieter entrance.' },
    hi: { title: 'लाइव भीड़ नक्शा', line: 'भीड़ वाले गेट देखें, खाली गेट चुनें।' } },
  { n: '17', id: 'vault', badge: 'Priority', effort: 'Medium', icon: 'download',
    en: { title: 'Offline Ticket Vault', problem: 'Internet often fails near crowded entrances.', solution: 'Tickets are stored on your phone for offline display; gate systems handle duplicate scans.' },
    hi: { title: 'ऑफ़लाइन टिकट तिजोरी', line: 'बिना इंटरनेट भी टिकट फ़ोन में।' } },
  { n: '18', id: 'pass', badge: null, effort: 'Medium', icon: 'check',
    en: { title: 'Campus Opportunity Pass', problem: 'Students attend events but miss the learning and career value.', solution: 'Links tickets to attendance certificates, volunteering and skill records.' },
    hi: { title: 'अवसर पास', line: 'हाज़िरी प्रमाणपत्र, वॉलंटियरिंग और स्किल रिकॉर्ड।' } },
  { n: '19', id: 'companion', badge: null, effort: 'High', icon: 'person',
    en: { title: 'Smart Companion Requests', problem: 'Students going alone want a trusted companion.', solution: 'Opt-in, verified, privacy-protected buddy matching. Seats and contacts are never shared automatically.' },
    hi: { title: 'साथी अनुरोध', line: 'सत्यापित, निजी और अपनी मर्ज़ी से साथी खोजें।' } },
  { n: '20', id: 'twin', badge: 'Standout', effort: 'High', icon: 'cube',
    en: { title: 'Campus Digital Twin Dashboard', problem: 'Organizers struggle to understand demand and seat use.', solution: 'Live seat states, occupancy, demand and what-if scenarios per venue.' },
    hi: { title: 'डिजिटल ट्विन', line: 'आयोजकों के लिए लाइव सीट, माँग और परिदृश्य।' } },
]
