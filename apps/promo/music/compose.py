#!/usr/bin/env python3
"""Composes the promo's original score and renders it.

The score is written as MIDI with a tempo map built from the scene timeline in
src/Root.tsx, so every cut falls on a beat. It comes in two stems: the
orchestra, and a choir built from several detuned and slightly late layers so
it sounds like a large chorus. FluidSynth plays each stem with the FluidR3_GM
soundfont, and ffmpeg gives them a hall, mixes and masters them.

    python3 apps/promo/music/compose.py            # MIDI stems and the AAC track
    python3 apps/promo/music/compose.py --midi     # MIDI stems only

Needs mido, fluidsynth and ffmpeg. Set SOUNDFONT to use another .sf2 file.
Every melody and progression here is original.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import mido

HERE = Path(__file__).resolve().parent
PROMO = HERE.parent
ROOT_TSX = PROMO / 'src' / 'Root.tsx'
OUT_DIR = PROMO / 'public' / 'music'
SOUNDFONT = os.environ.get('SOUNDFONT', '/usr/share/sounds/sf2/FluidR3_GM.sf2')
FPS = 30
TPB = 480
TARGET_BPM = 96
SAMPLE_RATE = 48000
LOUDNESS = -14
# The breath before the logo and the 1.0.0 hits, in seconds.
BREATH = 0.42

# ---------------------------------------------------------------------------
# Timeline


def read_timeline() -> tuple[list[tuple[str, int]], int]:
    """Scene names and start frames, and the total length, from Root.tsx."""
    source = ROOT_TSX.read_text()
    overlap = int(re.search(r'const OVERLAP = (\d+);', source).group(1))
    scenes = re.findall(r"name: '(\w+)',\s*frames: (\d+)", source)
    starts, at = [], 0
    for i, (name, frames) in enumerate(scenes):
        if i:
            at += int(scenes[i - 1][1]) - overlap
        starts.append((name, at))
    total = at + int(scenes[-1][1])
    return starts, total


@dataclass
class Segment:
    name: str
    start: float
    end: float
    beats: int
    tick0: int = 0

    @property
    def bpm(self) -> float:
        return 60 * self.beats / (self.end - self.start)

    @property
    def spb(self) -> float:
        return (self.end - self.start) / self.beats


def build_segments() -> tuple[list[Segment], float]:
    scenes, total = read_timeline()
    start = dict(scenes)
    # Cues inside a scene, in frames from its start: the ring lies down into the
    # logo (prologue.tsx) and the end card arrives (finale.tsx).
    anchors = [
        ('Prologue', 0),
        ('Logo', start['Prologue'] + 250),
        ('Map', start['Map']),
        ('Components', start['Components']),
        ('Signals', start['Signals']),
        ('Routes', start['Routes']),
        ('SSR', start['SSR']),
        ('FiveRealms', start['FiveRealms']),
        ('Agent', start['Agent']),
        ('Platforms', start['Platforms']),
        ('Finale', start['Finale']),
        ('EndCard', start['Finale'] + 132),
    ]
    segments = []
    for i, (name, frame) in enumerate(anchors):
        a = frame / FPS
        b = (anchors[i + 1][1] if i + 1 < len(anchors) else total) / FPS
        beats = max(1, round((b - a) * TARGET_BPM / 60))
        segments.append(Segment(name, a, b, beats))
    tick = 0
    for seg in segments:
        seg.tick0 = tick
        tick += seg.beats * TPB
    return segments, total / FPS


# ---------------------------------------------------------------------------
# Instruments: (stem, channel, GM program, pan, detune in cents, delay in ms, volume)


@dataclass
class Part:
    stem: str
    channel: int
    program: int
    pan: int
    cents: float = 0
    delay_ms: float = 0
    volume: int = 100


PARTS = {
    # Orchestra
    'strings': Part('orchestra', 0, 48, 34, volume=96),  # String Ensemble 1
    'cello': Part('orchestra', 1, 42, 52, volume=92),  # Cello, the ostinato
    'bass': Part('orchestra', 2, 43, 64, volume=110),  # Contrabass
    'tremolo': Part('orchestra', 3, 44, 94, volume=96),  # Tremolo Strings
    'horns': Part('orchestra', 4, 60, 44, volume=108),  # French Horn
    'trombone': Part('orchestra', 5, 57, 78, volume=104),  # Trombone
    'tuba': Part('orchestra', 6, 58, 64, volume=112),  # Tuba
    'timpani': Part('orchestra', 7, 47, 64, volume=120),  # Timpani
    'celesta': Part('orchestra', 8, 8, 86, volume=96),  # Celesta, the ring motif
    'drums': Part('orchestra', 9, 0, 64, volume=127),  # GM percussion
    'harp': Part('orchestra', 10, 46, 80, volume=96),  # Orchestral Harp
    'trumpet': Part('orchestra', 11, 56, 84, volume=92),  # Trumpet
    'swell': Part('orchestra', 12, 119, 64, volume=110),  # Reverse Cymbal
    'pizz': Part('orchestra', 13, 45, 40, volume=96),  # Pizzicato Strings
    'glock': Part('orchestra', 14, 9, 70, volume=70),  # Glockenspiel
    # Choir: three Aahs layers, two Oohs layers and a little Synth Voice as glue,
    # each a few cents off and a few milliseconds late, panned across the stage.
    'aahs_l': Part('choir', 0, 52, 26, cents=-8, delay_ms=0, volume=112),
    'aahs_r': Part('choir', 1, 52, 102, cents=7, delay_ms=17, volume=112),
    'aahs_c': Part('choir', 2, 52, 64, cents=-3, delay_ms=24, volume=100),
    'oohs_l': Part('choir', 3, 53, 36, cents=9, delay_ms=11, volume=100),
    'oohs_r': Part('choir', 4, 53, 92, cents=-6, delay_ms=21, volume=100),
    'synth': Part('choir', 5, 54, 64, cents=0, delay_ms=8, volume=52),
}
CHOIR = ['aahs_l', 'aahs_r', 'aahs_c', 'oohs_l', 'oohs_r', 'synth']
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

# GM percussion keys.
KICK, KICK2, LOW_TOM, FLOOR_TOM, HAT, CRASH, CRASH2 = 35, 36, 41, 43, 42, 49, 57


def n(name) -> int:
    """'D4' -> 62, 'Bb2' -> 46; numbers pass through."""
    if isinstance(name, int):
        return name
    m = re.fullmatch(r'([A-G])([b#]?)(-?\d)', name)
    pitch = NAMES[m.group(1)] + {'b': -1, '#': 1, '': 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + pitch


def voicing(root: str, quality: str, top: int = 81, bass: bool = True) -> list[int]:
    """A wide choral chord: root and fifth low, then the full triad in octaves up to `top`."""
    r = n(root)
    third = 3 if quality == 'minor' else 4
    notes = [r, r + 7] if bass else []
    for octave in (12, 24, 36):
        notes += [r + octave, r + octave + third, r + octave + 7]
    return sorted({p for p in notes if p <= top})


class Score:
    def __init__(self, segments: list[Segment]):
        self.segments = segments
        self.by = {s.name: s for s in segments}
        self.events: dict[str, list] = {'orchestra': [], 'choir': []}

    def tick(self, seg: str, beat: float) -> int:
        return self.by[seg].tick0 + round(beat * TPB)

    def _ms_to_ticks(self, seg: str, ms: float) -> int:
        return round(ms / 1000 / self.by[seg].spb * TPB)

    def note(self, part: str, seg: str, beat: float, length: float, pitches, vel: float):
        p = PARTS[part]
        if not isinstance(pitches, (list, tuple)):
            pitches = [pitches]
        on = self.tick(seg, beat) + self._ms_to_ticks(seg, p.delay_ms)
        off = on + max(1, round(length * TPB) - 6)
        for pitch in pitches:
            v = max(1, min(127, int(vel)))
            self.events[p.stem].append((on, 1, mido.Message('note_on', channel=p.channel, note=n(pitch), velocity=v)))
            self.events[p.stem].append((off, 0, mido.Message('note_off', channel=p.channel, note=n(pitch), velocity=0)))

    def sing(self, seg: str, beat: float, length: float, pitches, vel: float, oohs: bool = True):
        """The whole choir on one chord or line; Aahs lead, Oohs and Synth Voice blend underneath."""
        pitches = [n(x) for x in (pitches if isinstance(pitches, (list, tuple)) else [pitches])]
        for part in ('aahs_l', 'aahs_r', 'aahs_c'):
            self.note(part, seg, beat, length, pitches, vel)
        if oohs:
            self.note('oohs_l', seg, beat, length, pitches, vel - 10)
            self.note('oohs_r', seg, beat, length, pitches, vel - 10)
        low = [x for x in pitches if x < 60] or pitches[:1]
        self.note('synth', seg, beat, length, low, vel - 20)

    def cc(self, part: str, seg: str, beat: float, control: int, value: float):
        p = PARTS[part]
        v = max(0, min(127, int(value)))
        self.events[p.stem].append((self.tick(seg, beat), 0, mido.Message('control_change', channel=p.channel, control=control, value=v)))

    def ramp(self, parts, seg: str, b0: float, b1: float, v0: float, v1: float, steps: int = 24):
        for part in [parts] if isinstance(parts, str) else parts:
            for i in range(steps + 1):
                t = i / steps
                self.cc(part, seg, b0 + (b1 - b0) * t, 11, v0 + (v1 - v0) * t)

    def drum(self, seg: str, beat: float, key: int, vel: float, length: float = 0.25):
        self.note('drums', seg, beat, length, key, vel)

    def taiko(self, seg: str, beat: float, root: str, vel: float, crash: bool = False):
        """A heavy hit: bass drums, low toms and timpani together."""
        self.drum(seg, beat, KICK, vel)
        self.drum(seg, beat, KICK2, vel - 6)
        self.drum(seg, beat, FLOOR_TOM, vel - 4)
        self.drum(seg, beat, LOW_TOM, vel - 12)
        self.note('timpani', seg, beat, 1, [n(root) - 24, n(root) - 12], vel)
        if crash:
            self.drum(seg, beat, CRASH, vel, 4)
            self.drum(seg, beat, CRASH2, vel - 10, 4)

    def roll(self, seg: str, b0: float, b1: float, pitch: str, v0: float, v1: float, rate: int = 8):
        count = max(1, int((b1 - b0) * rate))
        for i in range(count):
            self.note('timpani', seg, b0 + i / rate, 1 / rate, pitch, v0 + (v1 - v0) * i / count)

    def breath(self, seg: str) -> float:
        """The beat where everything stops, BREATH seconds before the segment ends."""
        s = self.by[seg]
        return s.beats - BREATH / s.spb

    def write(self, stem: str, path: Path):
        mid = mido.MidiFile(type=1, ticks_per_beat=TPB)
        meta = mido.MidiTrack()
        mid.tracks.append(meta)
        meta.append(mido.MetaMessage('track_name', name=f'Pangular Inspector 1.0.0 ({stem})', time=0))
        last = 0
        for seg in self.segments:
            meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(seg.bpm), time=seg.tick0 - last))
            meta.append(mido.MetaMessage('marker', text=seg.name, time=0))
            last = seg.tick0
        track = mido.MidiTrack()
        mid.tracks.append(track)
        for part in PARTS.values():
            if part.stem != stem:
                continue
            if part.channel != 9:
                track.append(mido.Message('program_change', channel=part.channel, program=part.program, time=0))
            for control, value in ((7, part.volume), (10, part.pan), (11, 127), (91, 80), (93, 30)):
                track.append(mido.Message('control_change', channel=part.channel, control=control, value=value, time=0))
            # Detune with the pitch wheel; the default bend range is two semitones.
            track.append(mido.Message('pitchwheel', channel=part.channel, pitch=int(part.cents / 200 * 8191), time=0))
        last = 0
        for tick, _, msg in sorted(self.events[stem], key=lambda e: (e[0], e[1])):
            track.append(msg.copy(time=tick - last))
            last = tick
        mid.save(path)


# ---------------------------------------------------------------------------
# Motifs

# The ring motif: a rising fifth that turns back.
RING = [('A5', 0, 0.5), ('D6', 0.5, 0.5), ('E6', 1, 0.5), ('F6', 1.5, 1), ('E6', 2.5, 0.5), ('C6', 3, 1)]
# The call: a climb from the root to the fifth, answered by a fall.
CALL = [(0, 0, 1.5), (3, 1.5, 0.5), (7, 2, 2), (5, 4, 1), (3, 5, 1), (2, 6, 1)]


def call(major: bool) -> list[tuple[int, float, float]]:
    """The call over a minor chord, or with a major third over a major one."""
    return [(4 if major and i == 3 else i, b, length) for i, b, length in CALL]


def ostinato(s: Score, seg: str, roots: list[tuple[str, bool]], vel: float, end: float | None = None):
    """Eighth notes in the cellos: root, root, fifth, root, third, root, fifth, root."""
    beats = end if end is not None else s.by[seg].beats
    per = s.by[seg].beats / len(roots)
    for b2 in range(int(beats * 2)):
        b = b2 / 2
        root, minor = roots[min(len(roots) - 1, int(b // per))]
        step = [0, 0, 7, 0, 3 if minor else 4, 0, 7, 12][b2 % 8]
        s.note('cello', seg, b, 0.45, n(root) + step, vel + (16 if b2 % 4 == 0 else 0))


# ---------------------------------------------------------------------------
# The cues


def prologue(s: Score):
    seg = 'Prologue'
    beats = s.by[seg].beats
    stop = s.breath(seg)
    # Low male choir and basses, out of silence.
    s.ramp(['aahs_l', 'aahs_r', 'aahs_c', 'synth'], seg, 0, 4, 0, 96)
    s.ramp(['oohs_l', 'oohs_r'], seg, 1, 5, 0, 100)
    s.ramp('bass', seg, 0, 3, 0, 110)
    s.note('bass', seg, 0, stop, ['D1', 'D2'], 90)
    s.sing(seg, 0, stop, ['D2', 'A2', 'D3'], 84, oohs=False)
    s.note('oohs_l', seg, 1, stop - 1, ['A3', 'D4'], 76)
    s.note('oohs_r', seg, 1, stop - 1, ['A3', 'D4'], 76)
    # The ring forms: its motif on celesta and harp, then higher.
    for start, octave in ((1.5, -12), (6.5, 0)):
        for pitch, b, length in RING:
            s.note('celesta', seg, start + b, length, n(pitch) + octave, 66 if octave else 56)
            s.note('harp', seg, start + b, length + 1, n(pitch) - 12, 50)
    for b, p in ((0.5, 'A6'), (3, 'D7'), (5.5, 'F6'), (9, 'E7')):
        s.note('glock', seg, b, 1, p, 40)
    # The swell: tremolo, upper voices, horns and a timpani roll, then the breath.
    s.ramp('tremolo', seg, 6, stop, 10, 127)
    s.note('tremolo', seg, 6, stop - 6, ['D3', 'A3', 'D4', 'F4'], 96)
    s.ramp(['aahs_l', 'aahs_r', 'aahs_c', 'oohs_l', 'oohs_r'], seg, 8, stop, 96, 127)
    s.sing(seg, 8, stop - 8, ['F4', 'A4', 'D5'], 92)
    s.ramp('horns', seg, 9, stop, 30, 127)
    s.note('horns', seg, 9, stop - 9, ['A3', 'D4', 'E4'], 96)
    s.note('trombone', seg, 10, stop - 10, ['D2', 'A2'], 90)
    s.note('swell', seg, stop - 3, 3, 'C5', 120)
    s.roll(seg, stop - 3, stop, 'A2', 40, 120)


def logo(s: Score):
    """The ring becomes the logo: 'One devtools to rule them all.'"""
    seg = 'Logo'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 127)
    s.taiko(seg, 0, 'D3', 127, crash=True)
    s.taiko(seg, 3, 'G3', 118)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 124)
    s.note('tuba', seg, 0, 3, ['D1', 'D2'], 120)
    s.note('tuba', seg, 3, beats - 3, ['G1', 'G2'], 116)
    s.note('trombone', seg, 0, 3, ['D2', 'D3', 'A3'], 120)
    s.note('trombone', seg, 3, beats - 3, ['G2', 'D3', 'Bb3'], 116)
    s.note('horns', seg, 0, 3, ['D4', 'F4', 'A4'], 124)
    s.note('horns', seg, 3, beats - 3, ['D4', 'G4', 'Bb4'], 118)
    s.note('trumpet', seg, 0, 2, ['A4', 'D5'], 104)
    s.note('strings', seg, 0, 3, voicing('D2', 'minor', 86, bass=False), 120)
    s.note('strings', seg, 3, beats - 3, voicing('G2', 'minor', 86, bass=False), 114)
    s.note('tremolo', seg, 0, beats, ['D4', 'A4', 'D5'], 90)
    # Full SATB, D minor to G minor, wide and doubled.
    s.sing(seg, 0, 3, voicing('D2', 'minor', 81), 124)
    s.sing(seg, 3, beats - 3, voicing('G2', 'minor', 79), 118)
    s.note('celesta', seg, 0.5, 2, ['D6', 'A6'], 70)
    s.ramp(list(PARTS), seg, beats - 1.5, beats, 127, 70)


def realm_map(s: Score):
    seg = 'Map'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 110)
    progression = [('D3', 'minor'), ('Bb2', 'major'), ('F3', 'major'), ('C3', 'major')]
    per = beats / 4
    ostinato(s, seg, [(r, q == 'minor') for r, q in progression], 66)
    for i, (root, quality) in enumerate(progression):
        b = i * per
        chord = voicing(root, quality, 74, bass=False)
        s.note('strings', seg, b, per, chord, 78)
        s.note('bass', seg, b, per, n(root) - 12, 86)
        s.note('trombone', seg, b, per, [n(root) - 12, n(root)], 64)
        s.note('oohs_l', seg, b, per, chord[:3], 76)
        s.note('oohs_r', seg, b, per, chord[:3], 76)
        s.note('synth', seg, b, per, chord[:2], 60)
        for j, p in enumerate(chord[:5]):
            s.note('harp', seg, b + j * 0.25, 1.5, p + 12, 62)
        # Half-time steps: a low hit on the first beat of each chord.
        s.taiko(seg, b, root, 88 if i else 104, crash=i == 0)
    # A wordless choir melody: the call, sung high over the travelling basses.
    for interval, b, length in call(False):
        s.note('aahs_l', seg, 1 + b, length, n('D5') + interval, 98)
        s.note('aahs_r', seg, 1 + b, length, n('D5') + interval, 98)
        s.note('aahs_c', seg, 1 + b, length, n('D4') + interval, 90)
    s.note('aahs_l', seg, 8, beats - 8, ['E5', 'G5'], 90)
    s.note('aahs_r', seg, 8, beats - 8, ['E5', 'G5'], 90)
    # A bell each time a place lights up on the map (every 19 frames from frame 34).
    bells = ['D6', 'F6', 'A6', 'C7', 'D7', 'F7', 'E7', 'A7']
    for i, p in enumerate(bells):
        beat = ((34 + 19 * i) / FPS) / s.by[seg].spb
        s.note('glock', seg, beat, 1, p, 50)
        s.note('celesta', seg, beat, 1, n(p) - 12, 56)
    s.ramp('tremolo', seg, beats - 3, beats, 0, 120)
    s.note('tremolo', seg, beats - 3, 3, ['C3', 'G3', 'E4'], 90)
    s.note('swell', seg, beats - 2, 2, 'C5', 100)


PRODUCTS = [
    ('Components', 'D3', 'minor', 0),
    ('Signals', 'Bb2', 'major', -4),
    ('Routes', 'G2', 'minor', -7),
    ('SSR', 'A2', 'major', -5),
]


def products(s: Score):
    for k, (seg, root, quality, shift) in enumerate(PRODUCTS):
        beats = s.by[seg].beats
        build = k * 4
        for part in PARTS:
            s.cc(part, seg, 0, 11, 118)
        r = n(root)
        # The chapter title: a heavy hit with low brass in octaves and a held choral chord.
        s.taiko(seg, 0, root, 122, crash=True)
        s.note('tuba', seg, 0, 2, [r - 12, r], 116)
        s.note('trombone', seg, 0, 2, [r, r + 7, r + 12], 112)
        s.note('bass', seg, 0, beats, [r - 12, r], 100)
        # Strings and choir let go a beat early, so the next hit lands on air.
        s.note('strings', seg, 0, beats - 1, voicing(root, quality, 77, bass=False), 86 + build)
        s.sing(seg, 0, beats - 1.2, voicing(root, quality, 79), 100 + build)
        ostinato(s, seg, [(root, quality == 'minor')], 74 + build)
        # The call on horns, an octave above on trumpets in the last chapter.
        base = n('D4') + shift
        for interval, b, length in call(quality == 'major'):
            s.note('horns', seg, b, length, [base + interval - 12, base + interval], 100 + build)
            if k == 3:
                s.note('trumpet', seg, b, length, base + interval + 12, 90)
        # Half-time drums: heavy on 1 and 3 of each bar, soft toms between.
        for b in (2, 4, 6):
            s.taiko(seg, b, root, 100 if b == 4 else 86)
        for b2 in range(beats * 2):
            if b2 % 4:
                s.drum(seg, b2 / 2, LOW_TOM, 48 + (b2 % 2) * 6)
        # Tremolo builds into the next chapter's hit.
        s.ramp('tremolo', seg, beats - 2, beats, 20, 127)
        s.note('tremolo', seg, beats - 2, 2, [r + 12, r + 19, r + 24], 96)
        s.roll(seg, beats - 1, beats, root, 60, 110)
    s.note('swell', 'SSR', s.by['SSR'].beats - 3, 3, 'C5', 120)


def five_realms(s: Score):
    """The lift to F major."""
    seg = 'FiveRealms'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 120)
    progression = [('F2', 'major'), ('C3', 'major'), ('D3', 'minor'), ('Bb2', 'major')]
    per = beats / 4
    for i, (root, quality) in enumerate(progression):
        b = i * per
        r = n(root)
        s.taiko(seg, b, root, 120 if i == 0 else 100, crash=i == 0)
        s.note('bass', seg, b, per, [r - 12, r], 104)
        s.note('tuba', seg, b, per, [r - 12, r], 100)
        s.note('trombone', seg, b, per, [r, r + 7, r + 12], 96)
        s.note('strings', seg, b, per, voicing(root, quality, 84, bass=False), 100)
        s.note('horns', seg, b, per, voicing(root, quality, 72, bass=False)[2:5], 100)
        s.sing(seg, b, per, voicing(root, quality, 81), 112)
        for j in range(int(per * 2)):
            s.note('harp', seg, b + j / 2, 0.5, voicing(root, quality, 96, bass=False)[3 + j % 4] + 12, 58)
    for interval, b, length in call(True):
        s.note('trumpet', seg, b + 1, min(length, beats - b - 1), n('F4') + interval + 12, 92)
    s.ramp(list(PARTS), seg, beats - 2, beats, 120, 60)


def agent(s: Score):
    """A lighter pulse under the terminal, the choir hushed."""
    seg = 'Agent'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 96)
    progression = [('D3', 'minor'), ('Bb2', 'major'), ('F3', 'major'), ('C3', 'major')]
    per = beats / 4
    for i, (root, quality) in enumerate(progression):
        b = i * per
        r = n(root)
        chord = voicing(root, quality, 72, bass=False)
        s.note('strings', seg, b, per, chord[:4], 64)
        s.note('bass', seg, b, per, r - 12, 64)
        s.note('oohs_l', seg, b, per, chord[1:4], 64)
        s.note('oohs_r', seg, b, per, chord[1:4], 64)
        for b2 in range(int(per * 2)):
            s.note('pizz', seg, b + b2 / 2, 0.5, r + [0, 7, 12, 7][b2 % 4], 76 if b2 % 2 == 0 else 60)
        s.drum(seg, b, KICK, 74)
        s.drum(seg, b, FLOOR_TOM, 60)
    for start in (2, beats - 5):
        for pitch, b, length in RING:
            if start + b < beats:
                s.note('celesta', seg, start + b, length, pitch, 64)
    for b in range(beats):
        s.drum(seg, b + 0.5, HAT, 32)
    s.ramp('tremolo', seg, beats - 2, beats, 0, 100)
    s.note('tremolo', seg, beats - 2, 2, ['Bb2', 'F3', 'D4'], 80)
    s.note('swell', seg, beats - 2, 2, 'C5', 90)


def platforms(s: Score):
    """Broad horns and choir over Bb, F, C and A, then the breath."""
    seg = 'Platforms'
    beats = s.by[seg].beats
    stop = s.breath(seg)
    for part in PARTS:
        s.cc(part, seg, 0, 11, 112)
    progression = [('Bb2', 'major'), ('F2', 'major'), ('C3', 'major'), ('A2', 'major')]
    per = beats / 4
    for i, (root, quality) in enumerate(progression):
        b = i * per
        length = per if i < 3 else stop - b
        r = n(root)
        s.taiko(seg, b, root, 118 if i == 0 else 98, crash=i == 0)
        s.note('bass', seg, b, length, [r - 12, r], 104)
        s.note('tuba', seg, b, length, [r - 12, r], 98)
        s.note('trombone', seg, b, length, [r, r + 7], 94)
        s.note('strings', seg, b, length, voicing(root, quality, 84, bass=False), 98)
        s.sing(seg, b, length, voicing(root, quality, 77), 100)
    # The broad line: horns in octaves, the sopranos singing it with them.
    line = [('F4', 0, 2), ('A4', 2, 1), ('C5', 3, 1), ('A4', 4, 2), ('G4', 6, 1.2)]
    for p, b, length in line:
        length = min(length, stop - b)
        s.note('horns', seg, b, length, [n(p) - 12, n(p)], 116)
        s.note('aahs_l', seg, b, length, n(p) + 12, 104)
        s.note('aahs_r', seg, b, length, n(p) + 12, 104)
    s.ramp(['strings', 'aahs_l', 'aahs_r', 'aahs_c', 'oohs_l', 'oohs_r', 'tremolo'], seg, beats - 3, stop, 100, 127)
    s.note('tremolo', seg, beats - 3, stop - beats + 3, ['A3', 'E4', 'C#5'], 110)
    s.note('swell', seg, stop - 3, 3, 'C5', 124)
    s.roll(seg, stop - 2, stop, 'A2', 50, 124)


def finale(s: Score):
    """'VERSION 1.0.0': the heroic D major tutti."""
    seg = 'Finale'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 127)
    s.taiko(seg, 0, 'D3', 127, crash=True)
    for b in (2, 4, 6):
        s.taiko(seg, b, 'D3', 104 if b != 4 else 116)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 124)
    s.note('tuba', seg, 0, beats, ['D1', 'D2'], 120)
    s.note('trombone', seg, 0, beats, ['D2', 'D3', 'A3', 'F#3'], 118)
    s.note('strings', seg, 0, beats, voicing('D2', 'major', 90, bass=False), 122)
    s.note('tremolo', seg, 0, beats, ['D4', 'A4', 'D5', 'F#5'], 96)
    s.sing(seg, 0, beats, voicing('D2', 'major', 78), 122)
    # The call, now in D major: trumpets, horns and the sopranos together.
    for interval, b, length in call(True):
        s.note('trumpet', seg, b, length, n('D5') + interval, 112)
        s.note('horns', seg, b, length, [n('D4') + interval, n('D3') + interval], 118)
        s.note('aahs_l', seg, b, length, n('D5') + interval, 116)
        s.note('aahs_r', seg, b, length, n('D5') + interval, 116)
    s.roll(seg, beats - 1, beats, 'A2', 70, 124)
    s.note('swell', seg, beats - 2, 2, 'C5', 100)


def end_card(s: Score):
    seg = 'EndCard'
    beats = s.by[seg].beats
    for part in PARTS:
        s.cc(part, seg, 0, 11, 127)
    s.taiko(seg, 0, 'D3', 122, crash=True)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 112)
    s.note('tuba', seg, 0, 4, ['D1', 'D2'], 108)
    s.note('trombone', seg, 0, 3, ['D2', 'A2', 'D3'], 104)
    s.note('trombone', seg, 3, 2, ['G2', 'D3', 'B3'], 96)
    s.note('trombone', seg, 5, beats - 5, ['D2', 'A2', 'F#3'], 90)
    s.note('horns', seg, 0, 3, ['F#4', 'A4', 'D5'], 112)
    s.note('horns', seg, 3, 2, ['G4', 'B4', 'D5'], 100)
    s.note('horns', seg, 5, beats - 5, ['F#4', 'A4', 'D5'], 92)
    s.note('strings', seg, 0, beats, voicing('D2', 'major', 90, bass=False), 112)
    # The plagal turn in the choir, then a long D major to the end.
    s.sing(seg, 0, 3, voicing('D2', 'major', 78), 118)
    s.sing(seg, 3, 2, voicing('G2', 'major', 79), 108)
    s.sing(seg, 5, beats - 5, voicing('D2', 'major', 78), 104)
    for pitch, b, length in [('A5', 1, 0.5), ('D6', 1.5, 0.5), ('E6', 2, 0.5), ('F#6', 2.5, 1.5), ('A6', 4, 3)]:
        s.note('celesta', seg, b, length + 1, pitch, 86)
        s.note('glock', seg, b, length, pitch, 50)
        s.note('harp', seg, b, length + 2, n(pitch) - 12, 68)
    s.ramp([p for p in PARTS if p != 'drums'], seg, 2, beats - 0.3, 127, 0, steps=40)


def compose(midi_dir: Path) -> tuple[list[Segment], dict[str, Path]]:
    segments, _ = build_segments()
    score = Score(segments)
    for cue in (prologue, logo, realm_map, products, five_realms, agent, platforms, finale, end_card):
        cue(score)
    paths = {}
    for stem in ('orchestra', 'choir'):
        paths[stem] = midi_dir / f'score-{stem}.mid'
        score.write(stem, paths[stem])
    return segments, paths


# ---------------------------------------------------------------------------
# Render, mix and master


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stderr


def synth(midi: Path, wav: Path):
    run([
        'fluidsynth', '-ni', '-q', '-R', '1', '-C', '1', '-g', '0.4', '-r', str(SAMPLE_RATE),
        '-o', 'synth.reverb.room-size=0.9', '-o', 'synth.reverb.damp=0.3',
        '-o', 'synth.reverb.width=0.5', '-o', 'synth.reverb.level=0.7',
        '-o', 'synth.chorus.depth=6', '-o', 'synth.chorus.level=0.8',
        '-F', str(wav), SOUNDFONT, str(midi),
    ])


# A hall: many early reflections thinning into a long tail, on a band-limited
# copy so the low end stays dry and tight.
HALL_DELAYS = '41|67|97|131|173|229|293|367|449|547|661|797|953|1129|1327|1559'
HALL_DECAYS = '0.42|0.38|0.34|0.31|0.28|0.25|0.22|0.19|0.17|0.15|0.13|0.11|0.09|0.075|0.06|0.045'


def hall(label: str, out: str, wet: float, width: float) -> str:
    return (
        f'[{label}]extrastereo=m={width},asplit[{out}d][{out}w];'
        f'[{out}w]highpass=f=280,lowpass=f=7000,'
        f'aecho=1:0.45:{HALL_DELAYS}:{HALL_DECAYS}[{out}t];'
        f'[{out}d][{out}t]amix=inputs=2:weights=1 {wet}:normalize=0[{out}]'
    )


def breath_gate(segments: list[Segment]) -> str:
    """Pulls the hall down to near silence for the breath before the logo and the 1.0.0 hits."""
    by = {s.name: s for s in segments}
    terms = []
    for name in ('Logo', 'Finale'):
        hit = by[name].start
        a, b = hit - BREATH + 0.04, hit - 0.012
        # Down over 50 ms, held, back up in the last 12 ms before the hit.
        terms.append(f'0.95*clip((t-{a:.3f})/0.05,0,1)*clip(({b + 0.012:.3f}-t)/0.012,0,1)')
    return f"asetnsamples=n=128,volume=eval=frame:volume='1-({'+'.join(terms)})'"


def render(paths: dict[str, Path], length: float, out: Path, segments: list[Segment]):
    duck = breath_gate(segments)
    with tempfile.TemporaryDirectory() as tmp:
        stems = {}
        for stem, midi in paths.items():
            stems[stem] = Path(tmp) / f'{stem}.wav'
            synth(midi, stems[stem])
        fade_out = max(0.0, length - 3.4)
        graph = (
            f'[0:a]atrim=0:{length:.3f},apad=whole_dur={length:.3f},highpass=f=28[o0];'
            f'[1:a]atrim=0:{length:.3f},apad=whole_dur={length:.3f},highpass=f=90,volume=1.35[c0];'
            + hall('o0', 'orc', 0.32, 1.0) + ';'
            + hall('c0', 'cho', 0.48, 1.1) + ';'
            '[orc][cho]amix=inputs=2:weights=1 1:normalize=0,'
            'equalizer=f=250:t=q:w=1:g=-2,'
            'acompressor=threshold=-14dB:ratio=2:attack=40:release=300:makeup=1.5,'
            f'{duck},'
            f'afade=t=in:st=0:d=0.5,afade=t=out:st={fade_out:.3f}:d=3.4,atrim=0:{length:.3f}[mix]'
        )
        inputs = ['-i', str(stems['orchestra']), '-i', str(stems['choir'])]
        measure = run(['ffmpeg', '-hide_banner', *inputs, '-filter_complex',
                       f'{graph};[mix]loudnorm=I={LOUDNESS}:TP=-1.5:LRA=14:print_format=json[m]',
                       '-map', '[m]', '-f', 'null', '-'])
        stats = json.loads(measure[measure.rindex('{'):measure.rindex('}') + 1])
        loudnorm = (
            f'loudnorm=I={LOUDNESS}:TP=-1.5:LRA=14:linear=true'
            f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
            f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
            f":offset={stats['target_offset']}"
        )
        mastered = Path(tmp) / 'mastered.wav'
        run(['ffmpeg', '-hide_banner', '-y', *inputs, '-filter_complex',
             f'{graph};[mix]{loudnorm},alimiter=limit=0.84:attack=3:release=60:level=false[m]',
             '-map', '[m]', '-ar', str(SAMPLE_RATE), str(mastered)])
        out.parent.mkdir(parents=True, exist_ok=True)
        run(['ffmpeg', '-hide_banner', '-y', '-i', str(mastered), '-c:a', 'aac', '-b:a', '256k', str(out)])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--midi', action='store_true', help='write the MIDI stems only')
    args = parser.parse_args()
    segments, paths = compose(HERE)
    _, length = build_segments()
    print(f'{"cue":<12} {"start":>7} {"end":>7} {"beats":>5} {"bpm":>6}')
    for seg in segments:
        print(f'{seg.name:<12} {seg.start:7.2f} {seg.end:7.2f} {seg.beats:5d} {seg.bpm:6.1f}')
    for path in paths.values():
        print(f'wrote {path.relative_to(PROMO)}')
    if args.midi:
        return 0
    out = OUT_DIR / 'score.m4a'
    render(paths, length, out, segments)
    print(f'wrote {out.relative_to(PROMO)} ({out.stat().st_size / 1e6:.1f} MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
