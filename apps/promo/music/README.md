# Promo score

`public/music/score.m4a` is an original composition for the promo video. `compose.py` writes it as MIDI, plays it with FluidSynth and the FluidR3_GM soundfont (MIT licence), and masters it with ffmpeg. It uses no other samples or recordings.

The tempo map comes from the scene timeline in `src/Root.tsx`, so the hits land on the cuts. After you change the timeline, generate the score again:

```bash
python3 apps/promo/music/compose.py          # writes music/score.mid and public/music/score.m4a
python3 apps/promo/music/compose.py --midi   # MIDI only
```

It needs Python 3 with `mido`, `fluidsynth` and `ffmpeg`. Set `SOUNDFONT` to use another `.sf2` file. The master aims for -16 LUFS integrated with true peaks below -1 dBTP.
