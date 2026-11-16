#!/usr/bin/env python3
"""Composes the promo's original score and renders it.

The score is written as MIDI with a tempo map built from the scene timeline in
src/Root.tsx, so every cut falls on a beat. FluidSynth plays it with the
FluidR3_GM soundfont and ffmpeg mixes and masters it.

    python3 apps/promo/music/compose.py            # MIDI, WAV and the AAC track
    python3 apps/promo/music/compose.py --midi     # MIDI only

Needs mido, fluidsynth and ffmpeg. Set SOUNDFONT to use another .sf2 file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
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
    events: list = field(default_factory=list)

    @property
    def bpm(self) -> float:
        return 60 * self.beats / (self.end - self.start)

    def time(self, beat: float) -> float:
        return self.start + beat * (self.end - self.start) / self.beats


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
# Instruments (General MIDI programs, 0-based) and helpers

CH = {
    'strings': (0, 48, 64),  # String Ensemble 1
    'cello': (1, 42, 50),  # Cello, the ostinato
    'bass': (2, 43, 64),  # Contrabass
    'choir': (3, 52, 70),  # Choir Aahs
    'horns': (4, 60, 44),  # French Horn
    'trombone': (5, 57, 80),  # Trombone
    'tuba': (6, 58, 64),  # Tuba
    'timpani': (7, 47, 64),  # Timpani
    'celesta': (8, 8, 88),  # Celesta, the ring motif
    'drums': (9, 0, 64),  # GM percussion (channel 10)
    'glock': (10, 9, 40),  # Glockenspiel
    'harp': (11, 46, 76),  # Orchestral Harp
    'pizz': (12, 45, 58),  # Pizzicato Strings
    'trumpet': (13, 56, 84),  # Trumpet
    'swell': (14, 119, 64),  # Reverse Cymbal
    'oohs': (15, 53, 64),  # Voice Oohs
}

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n(name: str) -> int:
    """'D4' -> 62, 'Bb2' -> 46."""
    m = re.fullmatch(r'([A-G])([b#]?)(-?\d)', name)
    pitch = NAMES[m.group(1)] + {'b': -1, '#': 1, '': 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + pitch


def chord(*names: str) -> list[int]:
    return [n(x) for x in names]


class Score:
    def __init__(self, segments: list[Segment]):
        self.segments = segments
        self.by_name = {s.name: s for s in segments}
        self.events: list[tuple[int, int, mido.Message]] = []

    def tick(self, seg: str, beat: float) -> int:
        s = self.by_name[seg]
        return s.tick0 + round(beat * TPB)

    def note(self, part: str, seg: str, beat: float, length: float, pitches, vel: int):
        ch = CH[part][0]
        if isinstance(pitches, (int, str)):
            pitches = [pitches]
        on = self.tick(seg, beat)
        off = on + max(1, round(length * TPB) - 6)
        for p in pitches:
            p = n(p) if isinstance(p, str) else p
            v = max(1, min(127, int(vel)))
            self.events.append((on, 1, mido.Message('note_on', channel=ch, note=p, velocity=v)))
            self.events.append((off, 0, mido.Message('note_off', channel=ch, note=p, velocity=0)))

    def cc(self, part: str, seg: str, beat: float, control: int, value: float):
        ch = CH[part][0]
        v = max(0, min(127, int(value)))
        self.events.append((self.tick(seg, beat), 0, mido.Message('control_change', channel=ch, control=control, value=v)))

    def ramp(self, part: str, seg: str, b0: float, b1: float, v0: float, v1: float, control: int = 11, steps: int = 24):
        for i in range(steps + 1):
            t = i / steps
            self.cc(part, seg, b0 + (b1 - b0) * t, control, v0 + (v1 - v0) * t)

    def drum(self, seg: str, beat: float, key: int, vel: int, length: float = 0.25):
        self.note('drums', seg, beat, length, key, vel)

    def write(self, path: Path):
        mid = mido.MidiFile(type=1, ticks_per_beat=TPB)
        meta = mido.MidiTrack()
        mid.tracks.append(meta)
        meta.append(mido.MetaMessage('track_name', name='Pangular Inspector 1.0.0', time=0))
        last = 0
        for seg in self.segments:
            meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(seg.bpm), time=seg.tick0 - last))
            meta.append(mido.MetaMessage('marker', text=seg.name, time=0))
            last = seg.tick0
        track = mido.MidiTrack()
        mid.tracks.append(track)
        setup = []
        for part, (ch, program, pan) in CH.items():
            if ch != 9:
                setup.append(mido.Message('program_change', channel=ch, program=program))
            setup += [
                mido.Message('control_change', channel=ch, control=7, value=100),
                mido.Message('control_change', channel=ch, control=10, value=pan),
                mido.Message('control_change', channel=ch, control=91, value=70),
                mido.Message('control_change', channel=ch, control=93, value=20),
            ]
        for msg in setup:
            track.append(msg.copy(time=0))
        last = 0
        for tick, _, msg in sorted(self.events, key=lambda e: (e[0], e[1])):
            track.append(msg.copy(time=tick - last))
            last = tick
        mid.save(path)


# ---------------------------------------------------------------------------
# The cues. D minor, with a lift to F major for the five realms and a heroic
# D major at the end. Every melody here is original.

# The ring motif: a rising fifth that turns back, played on celesta and harp.
RING = [('A5', 0, 0.5), ('D6', 0.5, 0.5), ('E6', 1, 0.5), ('F6', 1.5, 1), ('E6', 2.5, 0.5), ('C6', 3, 1)]

# The horn call: a stepwise climb from the fifth, answered by a fall.
CALL = [(0, 0, 1.5), (3, 1.5, 0.5), (7, 2, 2), (5, 4, 1), (3, 5, 1), (2, 6, 1)]


def call(major: bool) -> list[tuple[int, float, float]]:
    """The horn call over a minor chord, or with a major third over a major one."""
    return [(4 if major and i == 3 else i, b, length) for i, b, length in CALL]


def prologue(s: Score):
    seg = 'Prologue'
    beats = s.by_name[seg].beats
    for part in ('strings', 'bass', 'oohs', 'choir'):
        s.cc(part, seg, 0, 11, 0)
    s.ramp('bass', seg, 0, 3, 0, 90)
    s.ramp('strings', seg, 1, beats, 20, 118)
    s.ramp('oohs', seg, 2, beats, 0, 110)
    s.ramp('choir', seg, beats - 5, beats, 0, 100)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 86)
    s.note('strings', seg, 1, beats - 1, ['D3', 'A3', 'D4'], 86)
    s.note('oohs', seg, 2, beats - 2, ['A4', 'D5'], 80)
    s.note('choir', seg, beats - 5, 5, ['D4', 'F4', 'A4'], 70)
    # The ring forms: the motif on celesta, then again higher with harp.
    for start, octave in ((1.5, 0), (6.5, 12)):
        for pitch, b, length in RING:
            s.note('celesta', seg, start + b, length, n(pitch) + octave - 12, 70 if octave else 60)
            s.note('harp', seg, start + b, length + 1, n(pitch) - 12, 50)
    # Embers: sparse glockenspiel.
    for b, p in ((0.5, 'A6'), (3, 'D7'), (5.5, 'F6'), (9, 'E7')):
        s.note('glock', seg, b, 1, p, 34)
    # Swell into the logo: reverse cymbal, timpani roll and the brass waking.
    s.note('swell', seg, beats - 3, 3, 'C5', 110)
    for i in range(16):
        s.note('timpani', seg, beats - 3 + i * 3 / 16, 0.2, 'A2', 40 + i * 5)
    s.cc('horns', seg, 0, 11, 30)
    s.ramp('horns', seg, beats - 4, beats, 30, 115)
    s.note('horns', seg, beats - 4, 4, ['A3', 'E4'], 80)


def logo(s: Score):
    """The ring becomes the logo, then 'One devtools to rule them all.'"""
    seg = 'Logo'
    beats = s.by_name[seg].beats
    for part in ('strings', 'oohs', 'choir', 'horns'):
        s.cc(part, seg, 0, 11, 120)
    s.drum(seg, 0, 49, 118, 4)  # crash
    s.drum(seg, 0, 35, 127, 2)  # bass drum
    s.note('timpani', seg, 0, 2, ['D2', 'A2'], 127)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 120)
    s.note('tuba', seg, 0, beats, 'D2', 110)
    s.note('trombone', seg, 0, beats, ['D3', 'A3'], 112)
    s.note('horns', seg, 0, 3, ['D4', 'F4', 'A4'], 118)
    s.note('horns', seg, 3, beats - 3, ['D4', 'G4', 'Bb4'], 112)
    s.note('trumpet', seg, 0, 2, ['A4', 'D5'], 96)
    s.note('choir', seg, 0, 3, ['D4', 'F4', 'A4', 'D5'], 120)
    s.note('choir', seg, 3, beats - 3, ['D4', 'G4', 'Bb4', 'D5'], 116)
    s.note('strings', seg, 0, 3, ['D3', 'A3', 'F4', 'D5'], 116)
    s.note('strings', seg, 3, beats - 3, ['G3', 'D4', 'Bb4', 'D5'], 112)
    s.note('celesta', seg, 0.5, 2, ['D6', 'A6'], 70)
    s.ramp('choir', seg, beats - 2, beats, 120, 90)
    s.ramp('horns', seg, beats - 2, beats, 120, 80)


def ostinato(s: Score, seg: str, roots: list[str], vel: int, beats_per_chord: int | None = None):
    """Travelling eighth notes in the cellos: root, root, fifth, root, third, root, fifth, root."""
    beats = s.by_name[seg].beats
    per = beats_per_chord or max(1, beats // len(roots))
    for b2 in range(beats * 2):
        b = b2 / 2
        root = n(roots[min(len(roots) - 1, int(b // per))])
        minor = roots[min(len(roots) - 1, int(b // per))] in ('D3', 'G3', 'A3')
        step = [0, 0, 7, 0, 3 if minor else 4, 0, 7, 12][b2 % 8]
        s.note('cello', seg, b, 0.45, root + step, vel + (14 if b2 % 4 == 0 else 0))


def realm_map(s: Score):
    seg = 'Map'
    beats = s.by_name[seg].beats
    roots = ['D3', 'Bb2', 'F3', 'C3']
    ostinato(s, seg, roots, 64)
    per = beats // 4
    chords = [
        ('D3', 'A3', 'D4', 'F4'),
        ('Bb2', 'F3', 'D4', 'F4'),
        ('F3', 'C4', 'F4', 'A4'),
        ('C3', 'G3', 'E4', 'G4'),
    ]
    s.cc('strings', seg, 0, 11, 80)
    s.cc('choir', seg, 0, 11, 70)
    for i, c in enumerate(chords):
        length = per if i < 3 else beats - 3 * per
        s.note('strings', seg, i * per, length, list(c), 70)
        s.note('bass', seg, i * per, length, n(c[0]) - 12, 76)
        s.note('choir', seg, i * per, length, [n(x) + 12 for x in c[1:3]], 50)
        # Harp rolls each chord upward.
        for j, p in enumerate(c + (c[1],)):
            s.note('harp', seg, i * per + j * 0.25, 1.5, n(p) + 12, 60)
    # A place lights up on the map every 19 frames from frame 34: a bell for each.
    start = s.by_name[seg].start
    seconds_per_beat = (s.by_name[seg].end - start) / beats
    bells = ['D6', 'F6', 'A6', 'C7', 'D7', 'F7', 'E7', 'A7']
    for i, p in enumerate(bells):
        beat = ((34 + 19 * i) / FPS) / seconds_per_beat
        s.note('glock', seg, beat, 1, p, 48)
        s.note('celesta', seg, beat, 1, n(p) - 12, 52)
    s.drum(seg, 0, 35, 80, 1)
    s.note('timpani', seg, 0, 1, 'D2', 90)
    s.note('swell', seg, beats - 2, 2, 'C5', 90)


PRODUCTS = [
    ('Components', ['D3'], ('D3', 'A3', 'D4', 'F4'), 0, False),
    ('Signals', ['Bb2'], ('Bb2', 'F3', 'D4', 'F4'), -4, True),
    ('Routes', ['G3'], ('G2', 'D3', 'Bb3', 'D4'), -7, False),
    ('SSR', ['A3'], ('A2', 'E3', 'C#4', 'E4'), -5, True),
]


def products(s: Score):
    for k, (seg, roots, harmony, shift, major) in enumerate(PRODUCTS):
        beats = s.by_name[seg].beats
        build = k * 5 - 8
        ostinato(s, seg, roots, 70 + build)
        # The chapter title: crash, timpani, low brass stab.
        s.drum(seg, 0, 49, 104 + build, 2)
        s.drum(seg, 0, 35, 120, 1)
        s.note('timpani', seg, 0, 1, [n(harmony[0]) - 12, n(harmony[1]) - 12], 120)
        s.note('trombone', seg, 0, 1, [n(harmony[0]), n(harmony[1])], 112)
        s.note('tuba', seg, 0, 1, n(harmony[0]) - 12, 108)
        s.note('bass', seg, 0, beats, n(harmony[0]) - 12, 90)
        s.cc('strings', seg, 0, 11, 90 + build)
        s.note('strings', seg, 0, beats, list(harmony), 78 + build)
        s.cc('choir', seg, 0, 11, 70 + build)
        s.note('choir', seg, 0, beats, list(harmony[1:]), 60 + build)
        # The horn call, moved to each chapter's chord.
        s.cc('horns', seg, 0, 11, 100)
        base = n('D4') + shift
        for interval, b, length in call(major):
            if b < beats:
                s.note('horns', seg, b, min(length, beats - b), base + interval, 92 + build)
        # Driving drums: low toms on the eighths, bass drum on the beats.
        for b2 in range(beats * 2):
            b = b2 / 2
            accent = b2 % 4 == 0
            s.drum(seg, b, 41 if b2 % 2 else 43, (80 if accent else 58) + build)
            if b2 % 2 == 0:
                s.drum(seg, b, 35, 84 + build)
        # Timpani answer on the last beats into the next chapter.
        for i in range(4):
            s.note('timpani', seg, beats - 1 + i * 0.25, 0.25, n(harmony[0]) - 12, 80 + i * 10)
    s.note('swell', 'SSR', s.by_name['SSR'].beats - 3, 3, 'C5', 110)


def five_realms(s: Score):
    """The lift to F major."""
    seg = 'FiveRealms'
    beats = s.by_name[seg].beats
    per = beats // 4
    chords = [
        ('F2', 'F3', 'C4', 'A4', 'F5'),
        ('C3', 'G3', 'E4', 'G4', 'C5'),
        ('D3', 'A3', 'F4', 'A4', 'D5'),
        ('Bb2', 'F3', 'D4', 'F4', 'Bb4'),
    ]
    s.drum(seg, 0, 49, 108, 4)
    s.drum(seg, 0, 57, 110, 4)
    s.drum(seg, 0, 35, 127, 2)
    s.note('timpani', seg, 0, 2, ['F2', 'C3'], 127)
    for part in ('strings', 'choir', 'horns'):
        s.cc(part, seg, 0, 11, 108)
    for i, c in enumerate(chords):
        b = i * per
        length = per if i < 3 else beats - 3 * per
        s.note('strings', seg, b, length, list(c[1:]), 88)
        s.note('bass', seg, b, length, n(c[0]) - 12, 92)
        s.note('tuba', seg, b, length, c[0], 92)
        s.note('choir', seg, b, length, list(c[2:]), 90)
        s.note('trombone', seg, b, length, list(c[1:3]), 80)
        s.note('horns', seg, b, length, [n(c[2]), n(c[3])], 88)
    # Trumpets carry the call in F major.
    for interval, b, length in call(True):
        if b < beats:
            s.note('trumpet', seg, b + 1, min(length, beats - b - 1), n('C5') + interval - 7, 80)
    for b2 in range(beats * 2):
        s.drum(seg, b2 / 2, 43 if b2 % 2 else 41, 60 if b2 % 4 else 82)
        s.note('harp', seg, b2 / 2, 0.5, n(chords[min(3, b2 // (2 * per))][2]) + 12 + (b2 % 3) * 4, 56)
    s.ramp('strings', seg, beats - 2, beats, 122, 70)
    s.ramp('choir', seg, beats - 2, beats, 122, 60)
    s.ramp('horns', seg, beats - 2, beats, 122, 50)


def agent(s: Score):
    """A lighter pulse under the terminal."""
    seg = 'Agent'
    beats = s.by_name[seg].beats
    roots = ['D3', 'Bb2', 'F3', 'C3']
    per = beats // 4
    s.cc('strings', seg, 0, 11, 64)
    s.cc('choir', seg, 0, 11, 50)
    for i, r in enumerate(roots):
        b = i * per
        length = per if i < 3 else beats - 3 * per
        third = 3 if r == 'D3' else 4
        s.note('strings', seg, b, length, [n(r), n(r) + 7, n(r) + 12 + third], 64)
        s.note('bass', seg, b, length, n(r) - 12, 60)
        for b2 in range(int(length * 2)):
            step = [0, 7, 12, 7][b2 % 4]
            s.note('pizz', seg, b + b2 / 2, 0.5, n(r) + step, 72 if b2 % 2 == 0 else 58)
        s.drum(seg, b, 35, 70)
    # The ring motif returns, quietly, as the agent answers.
    for start in (2, beats - 5):
        for pitch, b, length in RING:
            if start + b < beats:
                s.note('celesta', seg, start + b, length, pitch, 62)
    for b in range(beats):
        s.drum(seg, b + 0.5, 42, 34)  # closed hi-hat, very soft
    s.note('swell', seg, beats - 2, 2, 'C5', 84)


def platforms(s: Score):
    """Broad horns over Bb, F, C and the dominant."""
    seg = 'Platforms'
    beats = s.by_name[seg].beats
    per = max(1, beats // 4)
    chords = [
        ('Bb2', 'F3', 'D4', 'F4'),
        ('F2', 'C3', 'A3', 'F4'),
        ('C3', 'G3', 'E4', 'G4'),
        ('A2', 'E3', 'C#4', 'E4'),
    ]
    s.drum(seg, 0, 49, 110, 4)
    s.drum(seg, 0, 35, 120, 2)
    s.note('timpani', seg, 0, 1, ['Bb1', 'F2'], 118)
    for part in ('strings', 'choir', 'horns'):
        s.cc(part, seg, 0, 11, 112)
    for i, c in enumerate(chords):
        b = i * per
        length = per if i < 3 else beats - 3 * per
        s.note('strings', seg, b, length, list(c[1:]) + [n(c[3]) + 12], 96)
        s.note('bass', seg, b, length, n(c[0]) - 12, 100)
        s.note('trombone', seg, b, length, list(c[:2]), 92)
        s.note('choir', seg, b, length, list(c[2:]), 96)
    # The broad horn line: long notes in unison and octaves.
    line = [('F4', 0, 2), ('A4', 2, 1), ('C5', 3, 1), ('A4', 4, 2), ('G4', 6, 2)]
    for p, b, length in line:
        if b < beats:
            s.note('horns', seg, b, min(length, beats - b), [n(p) - 12, n(p)], 110)
    s.ramp('strings', seg, beats - 3, beats, 100, 127)
    s.ramp('choir', seg, beats - 3, beats, 100, 127)
    s.note('swell', seg, beats - 3, 3, 'C5', 118)
    for i in range(16):
        s.note('timpani', seg, beats - 2 + i / 8, 0.15, 'A2', 50 + i * 5)


def finale(s: Score):
    """'VERSION 1.0.0': the heroic D major, then the end card and its tail."""
    seg = 'Finale'
    beats = s.by_name[seg].beats
    for part in ('strings', 'choir', 'horns'):
        s.cc(part, seg, 0, 11, 127)
    s.drum(seg, 0, 49, 127, 4)
    s.drum(seg, 0, 57, 120, 4)
    s.drum(seg, 0, 35, 127, 2)
    s.note('timpani', seg, 0, 2, ['D2', 'A2'], 127)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 120)
    s.note('tuba', seg, 0, beats, 'D2', 116)
    s.note('trombone', seg, 0, beats, ['D3', 'A3', 'F#3'], 116)
    s.note('strings', seg, 0, beats, ['D3', 'A3', 'F#4', 'A4', 'D5'], 120)
    s.note('choir', seg, 0, beats, ['D4', 'F#4', 'A4', 'D5'], 124)
    # The call in D major, on trumpets and horns together.
    for interval, b, length in call(True)[:3]:
        s.note('trumpet', seg, b, length, n('D5') + interval, 110)
        s.note('horns', seg, b, length, n('D4') + interval, 116)
    for b in range(beats):
        s.drum(seg, b, 43, 100)
    s.note('swell', seg, max(0, beats - 2), 2, 'C5', 96)


def end_card(s: Score):
    seg = 'EndCard'
    beats = s.by_name[seg].beats
    s.drum(seg, 0, 49, 116, 6)
    s.drum(seg, 0, 35, 124, 2)
    s.note('timpani', seg, 0, 2, ['D2', 'A2'], 118)
    s.note('bass', seg, 0, beats, ['D1', 'D2'], 108)
    s.note('tuba', seg, 0, 4, 'D2', 100)
    s.note('trombone', seg, 0, 4, ['D3', 'A3'], 100)
    s.note('horns', seg, 0, 4, ['F#4', 'A4', 'D5'], 110)
    s.note('horns', seg, 4, beats - 4, ['G4', 'B4', 'D5'], 92)
    s.note('horns', seg, 6, beats - 6, ['F#4', 'A4', 'D5'], 86)
    s.note('strings', seg, 0, beats, ['D3', 'A3', 'F#4', 'A4', 'D5', 'F#5'], 110)
    s.note('choir', seg, 0, beats, ['D4', 'F#4', 'A4', 'D5'], 112)
    # The ring motif rings out in D major over the logo.
    for pitch, b, length in [('A5', 1, 0.5), ('D6', 1.5, 0.5), ('E6', 2, 0.5), ('F#6', 2.5, 1.5), ('A6', 4, 3)]:
        s.note('celesta', seg, b, length + 1, pitch, 84)
        s.note('glock', seg, b, length, pitch, 46)
        s.note('harp', seg, b, length + 2, n(pitch) - 12, 66)
    for part in ('strings', 'choir', 'horns', 'bass', 'trombone', 'tuba'):
        s.ramp(part, seg, 2, beats - 0.5, 127, 0)


def compose(midi_path: Path) -> list[Segment]:
    segments, _ = build_segments()
    score = Score(segments)
    prologue(score)
    logo(score)
    realm_map(score)
    products(score)
    five_realms(score)
    agent(score)
    platforms(score)
    finale(score)
    end_card(score)
    score.write(midi_path)
    return segments


# ---------------------------------------------------------------------------
# Render and master


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return result.stderr


def render(midi_path: Path, length: float, out: Path):
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / 'raw.wav'
        run([
            'fluidsynth', '-ni', '-q', '-R', '1', '-C', '1', '-g', '0.45', '-r', str(SAMPLE_RATE),
            '-o', 'synth.reverb.room-size=0.75', '-o', 'synth.reverb.width=1.0',
            '-o', 'synth.reverb.level=0.6', '-F', str(raw), SOUNDFONT, str(midi_path),
        ])
        fade_out = max(0.0, length - 3.2)
        chain = (
            f'atrim=0:{length:.3f},apad=whole_dur={length:.3f},'
            'highpass=f=30,'
            'aecho=0.85:0.5:47|83|131:0.22|0.16|0.11,'
            'extrastereo=m=1.25,'
            'acompressor=threshold=-20dB:ratio=2.5:attack=25:release=300:makeup=2,'
            f'afade=t=in:st=0:d=0.6,afade=t=out:st={fade_out:.3f}:d=3.2'
        )
        # Two-pass loudness normalisation to -16 LUFS and -1 dBTP.
        measure = run(['ffmpeg', '-hide_banner', '-i', str(raw), '-af',
                       f'{chain},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
        stats = json.loads(measure[measure.rindex('{'):measure.rindex('}') + 1])
        loudnorm = (
            'loudnorm=I=-16:TP=-1.5:LRA=11:linear=true'
            f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
            f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
            f":offset={stats['target_offset']}"
        )
        mastered = Path(tmp) / 'mastered.wav'
        run(['ffmpeg', '-hide_banner', '-y', '-i', str(raw), '-af',
             f'{chain},{loudnorm},alimiter=limit=0.87:level=false', '-ar', str(SAMPLE_RATE), str(mastered)])
        out.parent.mkdir(parents=True, exist_ok=True)
        run(['ffmpeg', '-hide_banner', '-y', '-i', str(mastered), '-c:a', 'aac', '-b:a', '256k', str(out)])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--midi', action='store_true', help='write the MIDI file only')
    args = parser.parse_args()
    midi_path = HERE / 'score.mid'
    segments = compose(midi_path)
    _, length = build_segments()
    print(f'{"cue":<12} {"start":>7} {"end":>7} {"beats":>5} {"bpm":>6}')
    for seg in segments:
        print(f'{seg.name:<12} {seg.start:7.2f} {seg.end:7.2f} {seg.beats:5d} {seg.bpm:6.1f}')
    print(f'wrote {midi_path.relative_to(PROMO)}')
    if args.midi:
        return 0
    out = OUT_DIR / 'score.m4a'
    render(midi_path, length, out)
    print(f'wrote {out.relative_to(PROMO)} ({out.stat().st_size / 1e6:.1f} MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
