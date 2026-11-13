"""Turn recorded guitar notes into SoundFont samples and instruments.

Each note is mixed to mono, trimmed of lead silence (so it lands on the beat),
measured and retuned to the exact pitch (cents correction in the sample
header), faded out once it has decayed 50 dB, resampled to 36 kHz, levelled
against its velocity layer by A-weighted loudness, peak limited where it must
be, and encoded as Ogg Vorbis for an SF3 bank (or 16-bit PCM for SF2).
"""
import os, re, subprocess, tempfile, json
import numpy as np, soundfile as sf
import sf2lib

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')  # downloads and cache, gitignored
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)

LAYERS = {
    'nylon': ['Vel01Finger', 'Vel02Pick', 'Vel03Pick'],
    'steel': ['Vel01', 'Vel02', 'Vel03'],
}


def channel1_map(kind):
    """{(key, layer): stem} from the reference SFZ's channel-1 (first position) regions."""
    sfz = open(os.path.join(HERE, f'wav-{kind}', f'meta-{kind}-guitar.sfz')).read()
    part = sfz.split('<master> lochan=1 hichan=1')[1].split('<master>')[0]
    out = {}
    for key, sample in re.findall(r'<region> key=(\d+) sample=(\S+)\.(?:wav|ogg)', part):
        layer = next(l for l in LAYERS[kind] if f'_{l}_' in sample)
        out[(int(key), layer)] = sample
    return out


def source_path(kind, stem):
    for root, _, files in os.walk(os.path.join(HERE, f'wav-{kind}')):
        if stem + '.wav' in files: return os.path.join(root, stem + '.wav')
    raise FileNotFoundError(stem)


def measure_cents(x, sr, key):
    exp = 440 * 2 ** ((key - 69) / 12)
    N = 1 << 18; vals = []
    for t in (0.1, 0.25, 0.4, 0.6, 0.8):
        seg = x[int(t * sr):int((t + 0.2) * sr)]
        if len(seg) < int(0.15 * sr): continue
        X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=N)); df = sr / N
        lo, hi = int(exp * 0.92 / df), int(exp * 1.08 / df)
        i = lo + int(np.argmax(X[lo:hi]))
        a, b, c = np.log(X[i - 1] + 1e-12), np.log(X[i] + 1e-12), np.log(X[i + 1] + 1e-12)
        f = (i + 0.5 * (a - c) / (a - 2 * b + c)) * df
        vals.append(1200 * np.log2(f / exp))
    return float(np.median(vals)) if vals else 0.0


TARGET_SR = 36000
TAIL_DB = -50
MAX_S = 4.5


def prepare(kind, stem, key, max_s=None, gain=1.0, path=None):
    max_s = max_s or (6.0 if key < 52 else MAX_S)
    x, sr = sf.read(path or source_path(kind, stem), always_2d=True)
    x = x.mean(axis=1)
    peak = np.max(np.abs(x))
    # lead silence: start 1.5 ms before the signal first reaches -40 dB of peak
    on = int(np.argmax(np.abs(x) > peak * 0.01))
    x = x[max(0, on - int(0.0015 * sr)):]
    # tail: frame RMS, cut where it stays under -60 dB of the loudest frame
    hop = int(0.01 * sr)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    above = np.where(e > e.max() * 10 ** (TAIL_DB / 20))[0]
    end = min(len(x), (above[-1] + 1) * hop if len(above) else len(x), int(max_s * sr))
    x = x[:end].copy()
    fade = min(int(0.4 * sr), len(x) // 3)
    x[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    x[:int(0.0015 * sr)] *= np.linspace(0, 1, int(0.0015 * sr))  # click-free start
    # tuning: the fundamental's spectral peak (what a tuner reads), median over 0.1-0.9 s
    cents = measure_cents(x, sr, key)
    if sr != TARGET_SR:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(sr, TARGET_SR)
        x = resample_poly(x, TARGET_SR // g, sr // g); sr = TARGET_SR
    return x * gain, sr, float(cents)


def encode(x, sr, ogg, quality):
    if not ogg:
        return (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes(), len(x)
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.wav'); o = os.path.join(td, 'a.ogg')
        sf.write(w, np.clip(x, -1, 1), sr, subtype='PCM_24')
        subprocess.run(['oggenc', '-Q', '-q', str(quality), '-o', o, w], check=True)
        return open(o, 'rb').read(), len(x)


def a_weight(x, sr):
    from scipy.signal import bilinear, lfilter
    f1, f2, f3, f4 = 20.598997, 107.65265, 737.86223, 12194.217
    num = [(2 * np.pi * f4) ** 2 * 10 ** (1.9997 / 20), 0, 0, 0, 0]
    den = np.polymul([1, 4 * np.pi * f4, (2 * np.pi * f4) ** 2], [1, 4 * np.pi * f1, (2 * np.pi * f1) ** 2])
    den = np.polymul(np.polymul(den, [1, 2 * np.pi * f3]), [1, 2 * np.pi * f2])
    b, a = bilinear(num, den, sr)
    return lfilter(b, a, x)


def loudness(x, sr):
    y = a_weight(x[:int(0.4 * sr)], sr)
    return 20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-12)


def raw(kind, stem, key, path=None):
    cache = os.path.join(CACHE, f'{stem}.raw.npz')
    if os.path.exists(cache):
        z = np.load(cache); return z['x'], int(z['sr']), float(z['cents'])
    x, sr, cents = prepare(kind, stem, key, path=path)
    np.savez(cache, x=x.astype(np.float32), sr=sr, cents=cents)
    return x, sr, cents


def release_for(key):
    # eight periods of the note: long enough not to wobble a bass note, short enough to catch only the attack
    f = 440 * 2 ** ((key - 69) / 12)
    return float(np.clip(8000.0 / f, 10.0, 80.0))


def soft_limit(x, ceiling, sr=48000, look_ms=2.0, release_ms=80.0):
    """Lookahead peak limiter: turns the gain down ahead of a peak and eases it back.
    No waveshaping, so no added harmonics; the result never exceeds the ceiling."""
    from scipy.ndimage import minimum_filter1d
    from scipy.signal import lfilter
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(x), 1e-12))
    la = max(1, int(look_ms * sr / 1000))
    # hold the lowest gain over the lookahead window, centred so it starts before the peak
    g = minimum_filter1d(need, size=2 * la + 1, mode='nearest')
    # release: one-pole rise back toward 1, never above what is needed
    a = np.exp(-1.0 / (release_ms * sr / 1000))
    out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):  # simple loop, fine at these lengths
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    # smooth the attack edge so the gain change itself is click-free
    k = np.hanning(la * 2 + 1); k /= k.sum()
    sm = np.convolve(out, k, mode='same')
    y = x * np.minimum(sm, out)
    return y * min(1.0, ceiling / max(np.max(np.abs(y)), 1e-12))


def build_samples(kind, ogg=True, quality=5, even=0.9, level=-20.0, limit_db=4.0, gap=0.5, report=False, layers=None, crest=None, offset=None):
    """Returns ({(key, layer): sample_index}, [Sample]).

    even:  how far each sample is pulled to its layer's typical loudness (0 = as recorded)
    level: A-weighted loudness of the first 400 ms that the loudest layer lands on, dBFS
    limit_db: how much transient peak may be rounded off instead of lowering everything
    """
    m = {kl: st for kl, st in channel1_map(kind).items() if layers is None or kl[1] in layers}
    items = {key_layer: (stem, *raw(kind, stem, key_layer[0])) for key_layer, stem in sorted(m.items())}
    L = {kl: loudness(v[1], v[2]) for kl, v in items.items()}
    layer_med = {l: float(np.median([L[kl] for kl in L if kl[1] == l])) for l in LAYERS[kind] if any(kl[1] == l for kl in L)}
    top = max(layer_med.values())
    gains = {}
    for kl in items:
        # pull each sample toward its layer, and close up the layers (velocity already scales level)
        g = even * (layer_med[kl[1]] - L[kl]) + (level - top) + (1 - gap) * (top - layer_med[kl[1]])
        g += (offset or {}).get(kl[1], 0.0)
        gains[kl] = float(np.clip(g, level - top - 15, level - top + 24))
    # whatever still pokes above -1 dBFS after limit_db of rounding comes down globally
    def crest_of(kl):
        return crest.get(kl[1]) if isinstance(crest, dict) else crest
    # a peak the crest cap will take down anyway should not pull the whole bank down
    worst = max(min(20 * np.log10(np.max(np.abs(v[1])) + 1e-12), L[kl] + (crest_of(kl) if crest_of(kl) is not None else 99)) + gains[kl]
                for kl, v in items.items())
    trim = min(0.0, -1.0 + limit_db - worst)
    samples, index = [], {}
    ceiling = 10 ** (-1 / 20)
    limited = []
    for kl, (stem, x, sr, cents) in items.items():
        y = x * 10 ** ((gains[kl] + trim) / 20)
        pk = np.max(np.abs(y))
        cr = crest.get(kl[1]) if isinstance(crest, dict) else crest
        cap = ceiling if cr is None else min(ceiling, 10 ** ((L[kl] + gains[kl] + trim + cr) / 20))
        if pk > cap:
            y = soft_limit(y, cap, sr, release_ms=release_for(kl[0])); limited.append(20 * np.log10(pk / np.max(np.abs(y))))
        data, frames = encode(y, sr, ogg, quality)
        index[kl] = len(samples)
        samples.append(sf2lib.Sample(f'{kind[0]}{kl[1][:5]}{kl[0]}', data, sr, kl[0], int(round(-cents)), ogg=ogg, frames=frames))
    if report:
        print(kind, 'layer loudness', {k: round(v, 1) for k, v in layer_med.items()}, 'trim', round(trim, 1), 'limited', len(limited), 'max dB', round(max(limited or [0]), 1))
    return index, samples


def tc(seconds):
    return int(round(1200 * np.log2(seconds)))


def instrument(name, index, base, splits, release=0.25, atten=0):
    """splits: [(layer, lovel, hivel)]. base: offset into the bank's sample list."""
    zones = []
    keys = sorted({k for k, _ in index})
    for layer, lo, hi in splits:
        for k in keys:
            if (k, layer) not in index: continue
            klo = k if k != keys[0] else 0
            khi = k if k != keys[-1] else 127
            gens = [(sf2lib.KEY_RANGE, klo | khi << 8), (sf2lib.VEL_RANGE, lo | hi << 8),
                    (38, tc(release) & 0xFFFF), (58, k)]
            if atten: gens.append((48, atten))
            zones.append((gens, base + index[(k, layer)]))
    return sf2lib.Instrument(name, zones)


def build_zoned(name, zones, layers, ogg=True, quality=5, even=0.9, level=-20.0, limit_db=4.0, gap=0.5, report=False, crest=None):
    """zones: [(path, keycenter, lokey, hikey, layer)]. Returns (zone list with sample index, [Sample])."""
    items = {}
    for path, kc, lo, hi, layer in zones:
        stem = name + '_' + os.path.basename(path).rsplit('.', 1)[0]
        items[(kc, layer)] = (stem, *raw(name, stem, kc, path=path), lo, hi)
    L = {kl: loudness(v[1], v[2]) for kl, v in items.items()}
    layer_med = {l: float(np.median([L[kl] for kl in L if kl[1] == l])) for l in layers}
    top = max(layer_med.values())
    gains = {kl: float(np.clip(even * (layer_med[kl[1]] - L[kl]) + (level - top) + (1 - gap) * (top - layer_med[kl[1]]),
                               level - top - 15, level - top + 22)) for kl in items}
    worst = max(20 * np.log10(np.max(np.abs(v[1])) + 1e-12) + gains[kl] for kl, v in items.items())
    trim = min(0.0, -1.0 + limit_db - worst)
    ceiling = 10 ** (-1 / 20)
    out, samples = [], []
    for kl, (stem, x, sr, cents, lo, hi) in sorted(items.items()):
        y = x * 10 ** ((gains[kl] + trim) / 20)
        cap = ceiling if crest is None else min(ceiling, 10 ** ((L[kl] + gains[kl] + trim + crest) / 20))
        if np.max(np.abs(y)) > cap: y = soft_limit(y, cap, sr, release_ms=release_for(kl[0]))
        data, frames = encode(y, sr, ogg, quality)
        out.append((kl[0], lo, hi, kl[1], len(samples)))
        samples.append(sf2lib.Sample(f'{name[:6]}{kl[1][:4]}{kl[0]}', data, sr, kl[0], int(round(-cents)), ogg=ogg, frames=frames))
    if report:
        print(name, 'layer loudness', {k: round(v, 1) for k, v in layer_med.items()}, 'trim', round(trim, 1))
    return out, samples


def zoned_instrument(name, zlist, base, splits, release=0.25, extra=()):
    """zlist from build_zoned; splits: [(layer, lovel, hivel)]."""
    zones = []
    for layer, lv, hv in splits:
        for kc, lo, hi, l, idx in zlist:
            if l != layer: continue
            gens = [(sf2lib.KEY_RANGE, lo | hi << 8), (sf2lib.VEL_RANGE, lv | hv << 8), (38, tc(release) & 0xFFFF), (58, kc)]
            gens += list(extra)
            zones.append((gens, base + idx))
    return sf2lib.Instrument(name, zones)


def parse_sfz(path):
    """[(sample path, keycenter, lokey, hikey, lovel, hivel)], first round-robin of each group."""
    text = open(path).read()
    base = os.path.dirname(path)
    out = []
    for grp in text.split('<group>')[1:]:
        hdr = grp.split('<region>')[0]
        get = lambda k, d: int(re.search(rf'\b{k}=(\d+)', hdr).group(1)) if re.search(rf'\b{k}=(\d+)', hdr) else d
        regions = re.findall(r'sample=(\S+)', grp)
        if not regions: continue
        key = get('key', None)
        kc = get('pitch_keycenter', key if key is not None else 60)
        lo = get('lokey', key if key is not None else 0); hi = get('hikey', key if key is not None else 127)
        out.append((os.path.join(base, regions[0]), kc, lo, hi, get('lovel', 1), get('hivel', 127)))
    return out
