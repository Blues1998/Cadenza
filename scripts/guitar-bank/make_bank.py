"""Cadenza guitar bank: CC0 recordings only.
  bank 1 / 0  Nylon               Meta Nylon Guitar, light pick, firm pick from ff
  bank 1 / 1  Nylon fingerstyle   Meta Nylon Guitar, fingerstyle
  bank 1 / 3  Steel acoustic      Meta Steel Guitar, medium, hard from ff
  bank 1 / 4  Chorus electric     FreePats FSBS clean, two voices detuned and spread
  bank 1 / 5  Clean electric      FreePats FSBS clean
  bank 1 / 6  12-string           Meta Steel Guitar, octave courses (E A D G) and unison courses (B E)
"""
import sys, os, re, glob
import sf2lib, samples as bm

WORK = bm.HERE

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'instruments', 'cadenza-guitars.sf3')
ogg = '--pcm' not in sys.argv
Q = 5

NOTE = {'C': 0, 'Cs': 1, 'D': 2, 'Ds': 3, 'E': 4, 'F': 5, 'Fs': 6, 'G': 7, 'Gs': 8, 'A': 9, 'As': 10, 'B': 11}
def midi(name):
    m = re.match(r'([A-G]s?)(\d)', name); return 12 * (int(m.group(2)) + 1) + NOTE[m.group(1)]

samples, insts, presets = [], [], []
def add(sl):
    base = len(samples); samples.extend(sl); return base

# --- nylon -------------------------------------------------------------------
F, P1, P2 = bm.LAYERS['nylon']
ni, ns = bm.build_samples('nylon', ogg=ogg, quality=Q, level=-19.2, limit_db=6, gap=0.3, report=True)
nb = add(ns)
insts.append(bm.instrument('Nylon', ni, nb, [(P1, 0, 102), (P2, 103, 127)]))
insts.append(bm.instrument('Nylon Finger', ni, nb, [(F, 0, 127)]))

# --- steel -------------------------------------------------------------------
S1, S2, S3 = bm.LAYERS['steel']
si, ss = bm.build_samples('steel', ogg=ogg, quality=Q, level=-18, limit_db=4, report=True, layers=[S2, S3])
sb = add(ss)
insts.append(bm.instrument('Steel', si, sb, [(S2, 0, 102), (S3, 103, 127)], atten=15))

# --- 12-string: each course is the main string plus its partner ---------------
# Partner for E A D G courses: the note an octave up (a real sample of that pitch);
# for B and E courses: the same pitch recorded on the neighbouring string.
wav = {os.path.basename(p)[:-4]: p for p in glob.glob(os.path.join(WORK, 'wav-steel', '**', '*.wav'), recursive=True)}
by_pitch = {}
for stem in wav:
    m = re.match(r'INSGuitarSteel_String(\w+?)_Vel02_([A-G]s?\d)_01', stem)
    if m: by_pitch.setdefault(midi(m.group(2)), {})[m.group(1)] = stem
c1 = bm.channel1_map('steel')
keys = sorted({k for k, l in c1 if l == S2})
partner_zones = []
for k in keys:
    main_string = re.match(r'INSGuitarSteel_String(\w+?)_', c1[(k, S2)]).group(1)
    if main_string in ('LowE', 'A', 'D', 'G') and k + 12 in by_pitch:
        cands = by_pitch[k + 12]
        pick = next((cands[s] for s in ('HighE', 'B', 'G', 'D') if s in cands), None)
    else:
        cands = by_pitch.get(k, {})
        pick = next((cands[s] for s in ('B', 'G', 'HighE', 'D') if s in cands and s != main_string), None)
    if pick:
        kc = midi(re.search(r'_([A-G]s?\d)_01', pick).group(1))
        partner_zones.append((wav[pick], kc, k, k, 'partner'))
pz, ps = bm.build_zoned('steel12', partner_zones, ['partner'], ogg=ogg, quality=Q, level=-21, limit_db=4, report=True)
pb = add(ps)
twelve = bm.instrument('12 String', si, sb, [(S2, 0, 127)]).zones
twelve = [(g + [(17, (-200) & 0xFFFF)], sid) for g, sid in twelve]  # main string a little left
for kc, lo, hi, l, idx in pz:
    lo2 = 0 if lo == keys[0] else lo; hi2 = 127 if hi == keys[-1] else hi
    # partner: pitched to the played key's octave or unison, a touch sharp, a little right
    gens = [(sf2lib.KEY_RANGE, lo2 | hi2 << 8), (38, bm.tc(0.25) & 0xFFFF), (58, kc - (12 if kc - lo == 12 else 0)),
            (52, 4), (17, 200)]
    # overridingRootKey makes the octave sample sound an octave up from the key played
    twelve.append((gens, pb + idx))
insts.append(sf2lib.Instrument('12 String', twelve))

# --- clean electric (FreePats FSBS, CC0) --------------------------------------
z = bm.parse_sfz(glob.glob(os.path.join(WORK, 'fsbs', 'EGuitarFSBS-clean SFZ+FLAC-*', '*.sfz'))[0])
zones = [(p, kc, lo, hi, 'soft' if hv <= 92 else 'hard') for p, kc, lo, hi, lv, hv in z]
single = {kc for p, kc, lo, hi, lv, hv in z if lv == 1 and hv == 127}
ez, es = bm.build_zoned('eclean', zones, ['soft', 'hard'], ogg=ogg, quality=Q, level=-18, limit_db=4, report=True)
ez = ez + [(kc, lo, hi, 'soft', i) for kc, lo, hi, l, i in ez if kc in single]
lo_kc = min(kc for kc, *_ in ez); hi_kc = max(kc for kc, *_ in ez)
ez = [(kc, 0 if kc == lo_kc else lo, 127 if kc == hi_kc else hi, l, i) for kc, lo, hi, l, i in ez]
eb = add(es)
insts.append(bm.zoned_instrument('Clean Electric', ez, eb, [('soft', 0, 92), ('hard', 93, 127)], release=0.35))
left = bm.zoned_instrument('Chorus L', ez, eb, [('soft', 0, 92), ('hard', 93, 127)], release=0.35,
                           extra=[(52, (-7) & 0xFFFF), (17, (-350) & 0xFFFF), (48, 19)]).zones
right = bm.zoned_instrument('Chorus R', ez, eb, [('soft', 0, 92), ('hard', 93, 127)], release=0.35,
                            extra=[(52, 7), (17, 350), (48, 19)]).zones
insts.append(sf2lib.Instrument('Chorus Electric', left + right))

names = ['Nylon', 'Nylon Finger', 'Steel', '12 String', 'Clean Electric', 'Chorus Electric']
prog = {'Nylon': 0, 'Nylon Finger': 1, 'Steel': 3, 'Chorus Electric': 4, 'Clean Electric': 5, '12 String': 6}
for idx, ins in enumerate(insts):
    presets.append(sf2lib.Preset(ins.name, 1, prog[ins.name], [([], idx)]))

sf2lib.write(out, presets, insts, samples, name='Cadenza Guitars',
             comment='Meta Nylon Guitar and Meta Steel Guitar (Meta, CC0 1.0); FSBS Electric Guitar Clean (FreePats, CC0 1.0).')
print(out, '%.1f MB' % (os.path.getsize(out) / 1e6), len(samples), 'samples')
