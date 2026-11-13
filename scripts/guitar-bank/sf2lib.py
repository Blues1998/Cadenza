"""Minimal SoundFont 2 / 3 reader and writer.

Model:
  Sample:     name, data (bytes: int16 LE PCM, or Ogg Vorbis when ogg=True),
              rate, pitch, corr, loop (start, end) relative to sample start, ogg
  Instrument: name, zones = [ (gens: list[(oper, amount)], sample_index | None) ]
  Preset:     name, bank, program, zones = [ (gens, instrument_index | None) ]
Generator amounts are raw 16-bit values (ranges packed lo | hi << 8).
"""
import struct

KEY_RANGE, VEL_RANGE, INSTRUMENT, SAMPLE_ID = 43, 44, 41, 53


class Sample:
    def __init__(self, name, data, rate, pitch, corr=0, loop=(0, 0), ogg=False, frames=None):
        self.name, self.data, self.rate, self.pitch = name, data, rate, pitch
        self.corr, self.loop, self.ogg = corr, loop, ogg
        self.frames = frames if frames is not None else (None if ogg else len(data) // 2)


class Instrument:
    def __init__(self, name, zones):
        self.name, self.zones = name, zones


class Preset:
    def __init__(self, name, bank, program, zones):
        self.name, self.bank, self.program, self.zones = name, bank, program, zones


def _chunk(cid, body):
    pad = b'\0' if len(body) % 2 else b''
    return cid + struct.pack('<I', len(body)) + body + pad


def _list(ltype, body):
    return _chunk(b'LIST', ltype + body)


def _zstr(s):
    b = s.encode('ascii', 'replace') + b'\0'
    return b + (b'\0' if len(b) % 2 else b'')


def _name(s):
    return s.encode('ascii', 'replace')[:19].ljust(20, b'\0')


def _order(gens):
    first = [g for g in gens if g[0] == KEY_RANGE] + [g for g in gens if g[0] == VEL_RANGE]
    rest = [g for g in gens if g[0] not in (KEY_RANGE, VEL_RANGE)]
    return first + rest


def write(path, presets, instruments, samples, name='Cadenza Guitars', comment=''):
    sf3 = any(s.ogg for s in samples)
    info = b''.join([
        _chunk(b'ifil', struct.pack('<HH', 3 if sf3 else 2, 1)),
        _chunk(b'isng', _zstr('EMU8000')),
        _chunk(b'INAM', _zstr(name)),
        _chunk(b'ICMT', _zstr(comment)),
        _chunk(b'ISFT', _zstr('cadenza sf2lib')),
    ])

    smpl = bytearray()
    shdr = b''
    for s in samples:
        if s.ogg:
            start = len(smpl)
            smpl += s.data
            end = len(smpl)
            ls, le = s.loop
            stype = 1 | 0x10
        else:
            start = len(smpl) // 2
            smpl += s.data
            end = len(smpl) // 2
            smpl += b'\0' * 92  # 46 zero frames, as the spec asks
            ls, le = (start + s.loop[0], start + s.loop[1]) if s.loop != (0, 0) else (start, start)
            stype = 1
        shdr += _name(s.name) + struct.pack('<IIIIIBbHH', start, end, ls, le, s.rate, s.pitch, s.corr, 0, stype)
    if len(smpl) % 2:
        smpl += b'\0'  # keep every chunk even: some readers ignore the RIFF pad byte
    shdr += _name('EOS') + struct.pack('<IIIIIBbHH', 0, 0, 0, 0, 0, 0, 0, 0, 0)

    inst = b''; ibag = b''; igen = b''
    gi = 0; bi = 0
    for ins in instruments:
        inst += _name(ins.name) + struct.pack('<H', bi)
        for gens, sidx in ins.zones:
            ibag += struct.pack('<HH', gi, 0)
            gl = _order(gens) + ([(SAMPLE_ID, sidx)] if sidx is not None else [])
            for op, amt in gl:
                igen += struct.pack('<HH', op, amt & 0xFFFF)
            gi += len(gl); bi += 1
    inst += _name('EOI') + struct.pack('<H', bi)
    ibag += struct.pack('<HH', gi, 0)
    igen += struct.pack('<HH', 0, 0)
    imod = b'\0' * 10

    phdr = b''; pbag = b''; pgen = b''
    gi = 0; bi = 0
    for p in sorted(presets, key=lambda p: (p.bank, p.program)):
        phdr += _name(p.name) + struct.pack('<HHHIII', p.program, p.bank, bi, 0, 0, 0)
        for gens, iidx in p.zones:
            pbag += struct.pack('<HH', gi, 0)
            gl = _order(gens) + ([(INSTRUMENT, iidx)] if iidx is not None else [])
            for op, amt in gl:
                pgen += struct.pack('<HH', op, amt & 0xFFFF)
            gi += len(gl); bi += 1
    phdr += _name('EOP') + struct.pack('<HHHIII', 0, 0, bi, 0, 0, 0)
    pbag += struct.pack('<HH', gi, 0)
    pgen += struct.pack('<HH', 0, 0)
    pmod = b'\0' * 10

    pdta = b''.join([_chunk(b'phdr', phdr), _chunk(b'pbag', pbag), _chunk(b'pmod', pmod), _chunk(b'pgen', pgen),
                     _chunk(b'inst', inst), _chunk(b'ibag', ibag), _chunk(b'imod', imod), _chunk(b'igen', igen),
                     _chunk(b'shdr', shdr)])
    body = b'sfbk' + _list(b'INFO', info) + _list(b'sdta', _chunk(b'smpl', bytes(smpl))) + _list(b'pdta', pdta)
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', len(body)) + body)


def read(path):
    """Returns (presets, instruments, samples) in the model above. PCM samples only."""
    buf = open(path, 'rb').read()
    chunks = {}
    smpl = b''

    def walk(start, end):
        nonlocal smpl
        o = start
        while o < end:
            cid = buf[o:o + 4]; size = struct.unpack_from('<I', buf, o + 4)[0]
            b = o + 8
            if cid == b'LIST':
                walk(b + 4, b + size)
            elif cid == b'smpl':
                smpl = buf[b:b + size]
            else:
                chunks[cid] = buf[b:b + size]
            o = b + size + (size % 2)

    walk(12, len(buf))
    rec = lambda cid, fmt: [struct.unpack_from(fmt, chunks[cid], i) for i in range(0, len(chunks[cid]), struct.calcsize(fmt))]
    phdr = rec(b'phdr', '<20sHHHIII'); pbag = rec(b'pbag', '<HH'); pgen = rec(b'pgen', '<HH')
    inst = rec(b'inst', '<20sH'); ibag = rec(b'ibag', '<HH'); igen = rec(b'igen', '<HH')
    shdr = rec(b'shdr', '<20sIIIIIBbHH')
    nm = lambda b: b.split(b'\0')[0].decode('ascii', 'replace')

    samples = []
    for (n, s, e, ls, le, rate, pitch, corr, link, stype) in shdr[:-1]:
        samples.append(Sample(nm(n), smpl[s * 2:e * 2], rate, pitch, corr, (ls - s, le - s) if le > ls else (0, 0)))
        samples[-1].stype = stype
    instruments = []
    for i in range(len(inst) - 1):
        zones = []
        for z in range(inst[i][1], inst[i + 1][1]):
            gens = [(op, amt) for op, amt in igen[ibag[z][0]:ibag[z + 1][0]]]
            sid = next((a for o, a in gens if o == SAMPLE_ID), None)
            zones.append(([g for g in gens if g[0] != SAMPLE_ID], sid))
        instruments.append(Instrument(nm(inst[i][0]), zones))
    presets = []
    for i in range(len(phdr) - 1):
        n, prog, bank, bag = phdr[i][:4]
        zones = []
        for z in range(bag, phdr[i + 1][3]):
            gens = [(op, amt) for op, amt in pgen[pbag[z][0]:pbag[z + 1][0]]]
            iid = next((a for o, a in gens if o == INSTRUMENT), None)
            zones.append(([g for g in gens if g[0] != INSTRUMENT], iid))
        presets.append(Preset(nm(n), bank, prog, zones))
    return presets, instruments, samples


def extract(src, wanted):
    """Copy presets from a parsed bank. wanted = [(bank, program, new_bank, new_program, new_name)]."""
    presets, instruments, samples = src
    out_p, out_i, out_s = [], [], []
    imap, smap = {}, {}
    for bank, prog, nb, np_, name in wanted:
        p = next(p for p in presets if p.bank == bank and p.program == prog)
        zones = []
        for gens, iid in p.zones:
            if iid is not None and iid not in imap:
                ins = instruments[iid]
                izones = []
                for g, sid in ins.zones:
                    if sid is not None and sid not in smap:
                        smap[sid] = len(out_s); out_s.append(samples[sid])
                    izones.append((g, smap.get(sid) if sid is not None else None))
                imap[iid] = len(out_i); out_i.append(Instrument(ins.name, izones))
            zones.append((gens, imap.get(iid) if iid is not None else None))
        out_p.append(Preset(name or p.name, nb, np_, zones))
    return out_p, out_i, out_s
