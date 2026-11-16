# Promo score

`public/music/score.m4a` is an original composition for the promo video. `compose.py` writes it as two MIDI stems, an orchestra and a choir. FluidSynth plays them with the FluidR3_GM soundfont (MIT licence), and ffmpeg gives each stem a hall, mixes them and masters the result. It uses no other samples or recordings.

The choir is several layers of the soundfont's Choir Aahs, Voice Oohs and Synth Voice. Each layer is detuned by a few cents, a few milliseconds late and panned apart, so together they sound like a large chorus.

The tempo map comes from the scene timeline in `src/Root.tsx`, so the hits land on the cuts. After you change the timeline, generate the score again:

```bash
python3 apps/promo/music/compose.py          # writes music/score-*.mid and public/music/score.m4a
python3 apps/promo/music/compose.py --midi   # MIDI stems only
```

It needs Python 3 with `mido`, `fluidsynth` and `ffmpeg`. Set `SOUNDFONT` to use another `.sf2` file. The master aims for -14 LUFS integrated with true peaks below -1 dBTP.
