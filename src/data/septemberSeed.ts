// Clean song library imported from Excel workbook
// Contains all 36 songs with chords, keys, capos, strumming patterns, and chord charts.

import type { Song } from '../utils/library';

export const INITIAL_SONGS: Song[] = [
  {
    id: 'song-sitaare',
    title: 'Sitaare',
    artist: 'Arijit Singh',
    day: 1,
    date: '2026-09-01',
    key: 'B♭ minor',
    capo: 1,
    chordsRaw: 'A min → F maj → G maj → E maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 8,
    practiceMinutes: 60,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788273000000,
    updatedAt: 1788273000000
  },
  {
    id: 'song-tera-mera-rishta',
    title: 'Tera mera rishta',
    artist: 'Mustafa Zahid',
    day: 2,
    date: '2026-09-02',
    key: 'E minor',
    capo: 0,
    chordsRaw: 'Em → D → C → Em',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 7,
    practiceMinutes: 600,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788359400000,
    updatedAt: 1788359400000
  },
  {
    id: 'song-labon-ko',
    title: 'Labon Ko',
    artist: 'KK',
    day: 3,
    date: '2026-09-03',
    key: 'A minor',
    capo: 0,
    chordsRaw: 'A min → G maj → F maj | E maj → D min → G maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 5,
    practiceMinutes: 60,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788445800000,
    updatedAt: 1788445800000
  },
  {
    id: 'song-kabhi-jo-badal-barse',
    title: 'Kabhi Jo Badal Barse',
    artist: 'Arijit Singh',
    day: 4,
    date: '2026-09-04',
    key: 'C minor',
    capo: 3,
    chordsRaw: 'A min → G maj → F maj → G maj| A min → G maj → E min | D min → G maj → F maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 5,
    practiceMinutes: 60,
    notes: 'Kabhi jo badal barse guitar tabs',
    revisit: false,
    chart: null,
    createdAt: 1788532200000,
    updatedAt: 1788532200000
  },
  {
    id: 'song-toh-fir-aao',
    title: 'Toh Fir aao',
    artist: 'Mustafa Zahid',
    day: 5,
    date: '2026-09-05',
    key: 'A minor',
    capo: 0,
    chordsRaw: 'A min → G maj → F maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 3,
    practiceMinutes: 30,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788618600000,
    updatedAt: 1788618600000
  },
  {
    id: 'song-jo-tum-mere-ho',
    title: 'Jo Tum Mere Ho',
    artist: 'Anuv Jain',
    day: 6,
    date: '2026-09-06',
    key: 'A minor',
    capo: 4,
    chordsRaw: 'A min  → E min → F maj → G maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 3,
    practiceMinutes: 5,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788705000000,
    updatedAt: 1788705000000
  },
  {
    id: 'song-lo-maan-liya',
    title: 'Lo Maan Liya',
    artist: 'Arijit Singh',
    day: 7,
    date: '2026-09-07',
    key: 'F♯ minor',
    capo: 2,
    chordsRaw: 'E min -> C maj -> B7 -> E min | E min -> A min -> B7 -> E min | E min -> C -> B7 -> G(single strum)',
    strumming: 'D/ DU/',
    status: 'learning',
    confidence: 2,
    practiceMinutes: 30,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1788791400000,
    updatedAt: 1788791400000
  },
  {
    id: 'song-tu-har-lamha',
    title: 'Tu Har Lamha',
    artist: 'Arijit Singh',
    day: 8,
    date: '2026-09-08',
    key: 'D minor',
    capo: 5,
    chordsRaw: 'A min -> E min -> F maj -> G maj | C maj -> E min -> F maj > C maj -> G maj',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 2,
    practiceMinutes: 30,
    notes: '5th fret DD UUD DDU',
    revisit: false,
    chart: null,
    createdAt: 1788877800000,
    updatedAt: 1788877800000
  },
  {
    id: 'song-khat',
    title: 'Khat',
    artist: 'Navjot Ahuja',
    day: 9,
    date: '2026-09-09',
    key: '',
    capo: 4,
    chordsRaw: '',
    strumming: 'D DUDU',
    status: 'complete',
    confidence: 0,
    practiceMinutes: 60,
    notes: 'Capo 4th fret No fret · pluck',
    revisit: false,
    chart: null,
    createdAt: 1788964200000,
    updatedAt: 1788964200000
  },
  {
    id: 'song-pehle-bhi-main',
    title: 'Pehle bhi main',
    artist: 'Vishal Mishra',
    day: 10,
    date: '2026-09-10',
    key: '',
    capo: 1,
    chordsRaw: 'A min -> G maj -> F maj -> E min',
    strumming: 'DD UUD DDU',
    status: 'complete',
    confidence: 3,
    practiceMinutes: 15,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789050600000,
    updatedAt: 1789050600000
  },
  {
    id: 'song-phir-mohabbat',
    title: 'Phir mohabbat',
    artist: 'Arijit Singh',
    day: 11,
    date: '2026-09-11',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'complete',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789137000000,
    updatedAt: 1789137000000
  },
  {
    id: 'song-gulabi-aankhein',
    title: 'Gulabi aankhein',
    artist: 'Kishore Kumar',
    day: 12,
    date: '2026-09-12',
    key: '',
    capo: 0,
    chordsRaw: 'A min -> G maj -> F maj -> E maj',
    strumming: '',
    status: 'complete',
    confidence: 3,
    practiceMinutes: 30,
    notes: 'plucking for la la la laaa, la la la la laa la laa',
    revisit: false,
    chart: null,
    createdAt: 1789223400000,
    updatedAt: 1789223400000
  },
  {
    id: 'song-uska-hi-bana',
    title: 'Uska hi bana',
    artist: 'Arijit Singh',
    day: 13,
    date: '2026-09-13',
    key: '',
    capo: 1,
    chordsRaw: '',
    strumming: 'D UUD UUD DU',
    status: 'complete',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789309800000,
    updatedAt: 1789309800000
  },
  {
    id: 'song-neele-neele-ambar-par',
    title: 'Neele Neele Ambar Par',
    artist: 'Kishore Kumar',
    day: 14,
    date: '2026-09-14',
    key: '',
    capo: 0,
    chordsRaw: '',
    strumming: 'DDU UDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: 'DROP D TUNING',
    revisit: false,
    chart: null,
    createdAt: 1789396200000,
    updatedAt: 1789396200000
  },
  {
    id: 'song-kabhi-na-kabhi-to-miloge',
    title: 'Kabhi na Kabhi to Miloge',
    artist: '',
    day: 15,
    date: '2026-09-15',
    key: '',
    capo: 4,
    chordsRaw: 'A min -> F maj -> G maj -> E maj | D min',
    strumming: 'D/U U/U | DU/U U/U | D U / UD (fast)',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789482600000,
    updatedAt: 1789482600000
  },
  {
    id: 'song-pehli-baar-mohabbat-ki-hai',
    title: 'Pehli Baar Mohabbat Ki Hai',
    artist: 'Mohit Chauhan',
    day: 16,
    date: '2026-09-16',
    key: '',
    capo: 0,
    chordsRaw: 'C maj -> D min | A min -> G maj -> F maj -> E min | C maj -> Emin -> F maj -> G maj',
    strumming: 'DD UUD DDU',
    status: 'learning',
    confidence: 2,
    practiceMinutes: 5,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789569000000,
    updatedAt: 1789569000000
  },
  {
    id: 'song-tum-hi-ho',
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    day: 17,
    date: '2026-09-17',
    key: '',
    capo: 1,
    chordsRaw: 'E min -> C maj -> D maj -> B min -> C maj',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789655400000,
    updatedAt: 1789655400000
  },
  {
    id: 'song-kaise-hua',
    title: 'Kaise Hua',
    artist: 'Vishal Mishra',
    day: 18,
    date: '2026-09-18',
    key: 'B min',
    capo: 0,
    chordsRaw: 'B min -> F#min -> E maj -> D maj -> A maj -> G maj',
    strumming: 'D DUDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789741800000,
    updatedAt: 1789741800000
  },
  {
    id: 'song-o-sajni-re',
    title: 'O Sajni Re',
    artist: 'Arijit Singh',
    day: 19,
    date: '2026-09-19',
    key: 'F maj',
    capo: 0,
    chordsRaw: 'F maj -> G maj -> F maj -> G maj -> A min/C maj| A min -> D min -> G maj -> C maj',
    strumming: 'DDU DUDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: {
    source: `(Fmaj7) O Sajni Re
(G) Kaise Kate Din Raat DDU DUDU
(Fmaj7) Kaise Ho Tujhse Baat
(G) Teri Yaad (Cmaj7) Satave Re
(Fmaj7) O Sajni Re
(G) Kaise Kate Din Raat
(Fmaj7) Kaise Miley Tera Saath
(G) Teri Yaad Teri (C) Yaad Satave Re
(Am) Kaise Ghane Re (Dm) Badra Ghirey
(G) Teri Kami Ki (Cmaj7) Baarish Uye
(Am) Sailaab Jo Mere (Dm) Seene Mein Hai
(G)Koi Bataye (Cmaj7) Ye Kaise Thamey
(Dm) Tere Bina (F6) Ab Kaise (G) Jiye
(Fmaj7) O Sajni Re
(G) Kaise Kate Din Raat
(Fmaj7) Kaise Ho Tujhse Baat
(G)Teri Yaad (Cmaj7) Satave Re
(Fmaj7) O Sajni Re
(G) Kaise Kate Din Raat
(Fmaj7) Kaise Miley Tera Saath
(G) Teri Yaad Teri (C) Yaad Satave Re`,
    lines: [],
    tempo: 100,
    beatsPerBar: 4,
    countInBars: 1,
    transpose: 0
  },
    createdAt: 1789828200000,
    updatedAt: 1789828200000
  },
  {
    id: 'song-tu-hai-ki-nahi',
    title: 'Tu hai ki nahi',
    artist: 'Arijit Singh',
    day: 20,
    date: '2026-09-20',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1789914600000,
    updatedAt: 1789914600000
  },
  {
    id: 'song-paaro',
    title: 'Paaro',
    artist: 'Aditya Rikhari',
    day: 21,
    date: '2026-09-21',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790001000000,
    updatedAt: 1790001000000
  },
  {
    id: 'song-baarishein',
    title: 'Baarishein',
    artist: 'Anuv Jain',
    day: 22,
    date: '2026-09-22',
    key: 'D maj',
    capo: 0,
    chordsRaw: 'D maj -> B min -> G maj -> D maj -> A maj',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790087400000,
    updatedAt: 1790087400000
  },
  {
    id: 'song-baarish',
    title: 'Baarish',
    artist: 'Mohammad Irfan',
    day: 23,
    date: '2026-09-23',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790173800000,
    updatedAt: 1790173800000
  },
  {
    id: 'song-tere-liye',
    title: 'Tere Liye',
    artist: 'Atif Aslam/Shreya Ghoshal',
    day: 24,
    date: '2026-09-24',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790260200000,
    updatedAt: 1790260200000
  },
  {
    id: 'song-agar-tum-mil-jao',
    title: 'Agar Tum Mil Jao',
    artist: 'Shreya Ghoshal',
    day: 25,
    date: '2026-09-25',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790346600000,
    updatedAt: 1790346600000
  },
  {
    id: 'song-aaj-bhi',
    title: 'Aaj Bhi',
    artist: 'Vishal Mishra',
    day: 26,
    date: '2026-09-26',
    key: 'A minor',
    capo: 4,
    chordsRaw: '',
    strumming: 'Du/ Du/',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790433000000,
    updatedAt: 1790433000000
  },
  {
    id: 'song-milne-hai-mujhse-aayi',
    title: 'Milne Hai Mujhse Aayi',
    artist: 'Arijit Singh',
    day: 27,
    date: '2026-09-27',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790519400000,
    updatedAt: 1790519400000
  },
  {
    id: 'song-ae-dil-hai-mushkil',
    title: 'Ae Dil Hai Mushkil',
    artist: 'Arijit Singh',
    day: 28,
    date: '2026-09-28',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790605800000,
    updatedAt: 1790605800000
  },
  {
    id: 'song-arz-kiya-hai',
    title: 'Arz Kiya Hai',
    artist: 'Anuv Jain',
    day: 29,
    date: '2026-09-29',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790692200000,
    updatedAt: 1790692200000
  },
  {
    id: 'song-tu-hi-haqeekat',
    title: 'Tu Hi Haqeekat',
    artist: 'KK',
    day: 30,
    date: '2026-09-30',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790778600000,
    updatedAt: 1790778600000
  },
  {
    id: 'song-tum-mile',
    title: 'Tum Mile',
    artist: '',
    day: 31,
    date: '2026-10-01',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790865000000,
    updatedAt: 1790865000000
  },
  {
    id: 'song-tu-jaane-na',
    title: 'Tu Jaane Na',
    artist: 'Atif Aslam',
    day: 32,
    date: '2026-10-02',
    key: '',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1790951400000,
    updatedAt: 1790951400000
  },
  {
    id: 'song-phir-le-aaya-dil',
    title: 'Phir Le Aaya Dil',
    artist: 'Arijit Singh',
    day: 33,
    date: '2026-10-03',
    key: 'G maj',
    capo: null,
    chordsRaw: '',
    strumming: '',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: {
    source: `Phir le (G) aaya dil (D) majboor kya kije
Raas na (G) aaya rehna (D) door kya kije
(D) Dil keh (C) raha hai use
(G) mukammal kar bhi aao
Woh jo (Em) adhoori si (G) baat baki (D) hai
Woh jo (G) adhoori si (D) yaad baki (G) hai
Woh jo (G) adhoori (D) yaad baki (G) hai
Karte (G) hai hum aaj (D) kubool kya kije
Ho gayi (G) thi humse (D) bhool kya kije
(D) Dil keh (C) raha hai use
Use (G) mayassar kar bhi aao
Woh jo (Em) dabi si (G) aas baaki (D) hai
Woh jo (G) dabi si (D) aanch baaki (G) hai
Woh jo (G) dabi si (D) aanch baaki (G) hai
(G) Kismat ko hai yeh (D) manzoor kya kije
Milte (G) rahe hum (D) badastoor kya kije
(D) Dil keh (C) raha hai use
(G) musalsal kar bhi aao
Woh jo (Em) ruki si (G) raah baki (D) hai
Woh jo (G) ruki si (D) chaah baki (G) hai
Woh jo (G) ruki si (D) chaah baki (G) hai`,
    lines: [],
    tempo: 100,
    beatsPerBar: 4,
    countInBars: 1,
    transpose: 0
  },
    createdAt: 1791037800000,
    updatedAt: 1791037800000
  },
  {
    id: 'song-khaab',
    title: 'Khaab',
    artist: 'Akhil',
    day: 34,
    date: '2026-10-04',
    key: 'A minor',
    capo: 0,
    chordsRaw: 'Amin -> F maj -> C maj -> G maj',
    strumming: 'DU/ DUD U/ | DD UUU DUDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1791124200000,
    updatedAt: 1791124200000
  },
  {
    id: 'song-wo-ladki',
    title: 'Wo Ladki',
    artist: 'Arijit Singh',
    day: 35,
    date: '2026-10-05',
    key: 'E minor',
    capo: 1,
    chordsRaw: 'E min -> B7 -> E min -> Amin -> B7',
    strumming: 'DD UUD DDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: null,
    createdAt: 1791210600000,
    updatedAt: 1791210600000
  },
  {
    id: 'song-tum-ho-toh',
    title: 'Tum Ho Toh',
    artist: 'Vishal Mishra',
    day: 36,
    date: '2026-10-06',
    key: 'B',
    capo: 1,
    chordsRaw: 'C maj -> F maj -> G maj | D min -> E min -> F maj -> A min',
    strumming: 'DD UUD DDU',
    status: 'learning',
    confidence: 0,
    practiceMinutes: 0,
    notes: '',
    revisit: false,
    chart: {
    source: `[Intro]
C Cmaj7 F Dm G DD UUD DDU
[Verse]
C
In haathon mein jab se hai
F                G
Aaya yeh haath tumhara
C
Jaise dariya ki halchal ko
F          G
Mil jaaye koi kinaara
[Pre-Chorus]
Dm
Tumhare sang aawargi bhi
Em
Aawargi bhi
F            Am
Deti hai jaise sukoon
F
Tumhare sang har ek lamha
G
Har ek lamha
Dm             G
Yaad nayi main bunoon
[Chorus]
F            C
Tum Ho toh subha nayi hai
F                C
Tum Ho toh shaamein haseen hai
F             G
Ik duniya sapnon si hai
F             G
Tum Ho toh ispe yakin hai
F      G    C
Tum Ho toh sab achha hai
F        G       C
Tum Ho toh waqt thama hai
Am        G     F
Tum Ho toh yeh lamha hai
Dm              G
Tum Ho toh ismein sadaa hai
F G    C F G
Tum Ho toh
Am    G          F  Dm  G
Is lamhe mein sadaa hai
[Verse]
C           F           G
Tum mile in dardon mein raahat ban ke
C           F       G
Tum mile ik sufi ki chahat ban ke
Dm        F          G
Main kya kahun koi lavz hi qabil nahi hain
Dm     F    G
Par mujhko itna hai pata
[Pre-Chorus]
Dm
Tumhaari in aankhon se saare
Em             F             Am
Aankhon se sare le lu andhere tere
F
Meri jaan abhi batenge mil ke
G              Dm          G
Baatenge mil ke saare savere merе
[Chorus]
F               C
Tum ho to dhoop hai maddham
F               C
Tum ho to chhaav hai har dam
F               G
Tum ho to haqq mein hai mere
F          G
aatе jaate ye mausam
F      G    C
Tum Ho toh sab achha hai
F        G       C
Tum Ho toh waqt thama hai
Am        G     F
Tum Ho toh yeh lamha hai
Dm              G
Tum Ho toh ismein sadaa hai
[Verse]
C                  F           G
Hum, na jaane aise hum kab hanse the
C               F         G
Hum aise hi besabab jee rahe the
Am                  G
Meri ye duaaein sun li kisi ne
F                  G
Lagta hai sach mein khuda hai
Am                  G
Aise to koi bhi milta kahaan hai
F                  G
Jaise mujhko tu mila
[Pre-Chorus]
Dm
Tumhare sang jo bhi mila hai
Em             F             Am
Ab ek pal bhi khona nahi hai mujhe
F
Tumhare sang raato jagg ke
G              Dm             G
dekhu tumhe Bas sona nahi hai mujhe
[Chorus]
F      G    C
Tum Ho toh sab achha hai
F        G       C
Tum Ho toh waqt thama hai
Am        G     F
Tum Ho toh yeh lamha hai
Dm              G
Tum Ho toh ismein sadaa hai
F      G         C
Tum ho toh jab ho tum
F G
Jo tum to
F              G
Tum ho toh tum hi tum ho.`,
    lines: [],
    tempo: 100,
    beatsPerBar: 4,
    countInBars: 1,
    transpose: 0
  },
    createdAt: 1791297000000,
    updatedAt: 1791297000000
  },
];

// Kept for backward compatibility
export const SEED_SONGS: Song[] = INITIAL_SONGS;
export const SEED_CHALLENGE = null;
