# Drum Practice Trainer

A web-based drum practice application for mastering rhythm variations, accents, and drum pattern permutations.

🥁 **Live Demo**: https://yoshiwatanabe.github.io/drums-trainer/

## Features

- 🎵 **Interactive Drum Notation** - VexFlow-based percussion staff display
- 🔊 **Synthesized Audio Playback** - Realistic drum sounds using Web Audio API
- 🎚️ **BPM Control** - Adjustable tempo (40-240 BPM)
- 🔁 **Loop Playback** - Continuous pattern practice
- 🔍 **Pattern Search** - Filter by title and tags
- 📦 **External Data Loading** - Patterns loaded from separate GitHub Pages repository

## Tech Stack

- **Pure JavaScript (ES6)** - No frameworks
- **Web Audio API** - Noise-based drum synthesis (kick, snare, hi-hat, ride)
- **VexFlow 4.2.2** - Music notation rendering
- **GitHub Pages** - Static hosting with CORS support

## Project Structure

```
drums-trainer/              # Main application
├── index.html             # UI layout
├── app.js                 # Core logic
├── style.css              # Dark theme styles
├── lib/vexflow.js         # VexFlow library (local)
└── patterns/              # Local pattern files (fallback)

drums-trainer-data/        # Separate data repository
└── patterns/              # Pattern JSON files
    ├── index.json         # Pattern manifest
    ├── patt_001.json
    ├── patt_002.json
    └── patt_003.json
```

## Data Loading Strategy

The app uses a 3-tier fallback system:

1. **GitHub Pages** (primary): `https://yoshiwatanabe.github.io/drums-trainer-data`
2. **Local files** (fallback): `patterns/*.json`
3. **Embedded patterns** (final fallback): Hardcoded in `app.js`

## Adding New Patterns

### Option 1: Via Data Repository (Recommended)

1. Clone the data repository:
   ```bash
   git clone https://github.com/yoshiwatanabe/drums-trainer-data.git
   ```

2. Add a new pattern JSON file to `patterns/`:
   ```json
   {
     "id": "patt_004",
     "title": "Your Pattern Name",
     "tags": ["tag1", "tag2"],
     "time_signature": "4/4",
     "bpm_default": 70,
     "loop_length_beats": 4,
     "events": [
       { "time": 0, "note": "kick", "velocity": 100 }
     ],
     "notation": {
       "vexflow": { ... }
     }
   }
   ```

3. Update `patterns/index.json`:
   ```json
   {
     "patterns": [
       "patt_001.json",
       "patt_002.json",
       "patt_003.json",
       "patt_004.json"
     ]
   }
   ```

4. Commit and push - patterns update automatically!

### Option 2: Local Development

Modify `app.js` and set `DATA_BASE_URL = null` to use local patterns.

## Pattern JSON Format

### Required Fields

- `id`: Unique identifier (e.g., "patt_001")
- `title`: Pattern name
- `tags`: Array of searchable tags
- `time_signature`: Currently "4/4"
- `bpm_default`: Default tempo
- `loop_length_beats`: Pattern duration in beats
- `events`: Array of drum hit events
- `notation`: VexFlow rendering data

### Event Format

```json
{
  "time": 0.0,        // Beat position (0.25 = 16th note)
  "note": "kick",     // Drum type: kick, snare, hihat_closed, hihat_open, ride
  "velocity": 100     // Hit intensity (0-127)
}
```

### VexFlow Notation

VexFlow percussion clef mapping:
- Kick: `f/4`
- Snare: `c/5`
- Hi-hat: `g/5`
- Ride: `f/5`

## Development

### Local Testing

```bash
# Start local server
python -m http.server 8000

# Open browser
http://localhost:8000
```

### Building

No build step required - pure static files!

## Audio Synthesis

Custom Web Audio API synthesis:

- **Kick**: 150Hz→50Hz sine wave sweep
- **Snare**: Triangle wave + filtered white noise (1500Hz HPF)
- **Hi-hat**: White noise + 7000Hz highpass filter
- **Ride**: Extended hi-hat with open duration

## Future Plans (v.Next)

See `vnext.md` for MIDI-based architecture:

- MIDI file generation/export
- MusicXML export
- High-quality soundfont audio
- LLM-powered pattern generation
- Python/FastAPI backend
- Pattern sharing/community features

## Related Repositories

- **Data Repository**: [drums-trainer-data](https://github.com/yoshiwatanabe/drums-trainer-data)
- **Specification**: See `spec.md` in this repo

## License

MIT

## Author

[@yoshiwatanabe](https://github.com/yoshiwatanabe)
