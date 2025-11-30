// Drum Practice Trainer - MVP scaffolding

const state = {
    audioCtx: null,
    patterns: [],
    filtered: [],
    currentPattern: null,
    bpm: 120,
    isLooping: true,
    isPlaying: false,
    scheduler: null
};

const dom = {};

window.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    cacheDom();
    bindUi();
    await loadPatterns();
    renderPatternList();
    if (state.filtered.length) {
        selectPattern(state.filtered[0]);
    }
}

function cacheDom() {
    dom.patternList = document.getElementById('patternList');
    dom.searchInput = document.getElementById('searchInput');
    dom.tagInput = document.getElementById('tagInput');
    dom.bpmRange = document.getElementById('bpmRange');
    dom.bpmRangeValue = document.getElementById('bpmRangeValue');
    dom.bpmInput = document.getElementById('bpmInput');
    dom.patternTitle = document.getElementById('patternTitle');
    dom.patternTags = document.getElementById('patternTags');
    dom.patternDetails = document.getElementById('patternDetails');
    dom.playBtn = document.getElementById('playBtn');
    dom.stopBtn = document.getElementById('stopBtn');
    dom.loopToggle = document.getElementById('loopToggle');
    dom.notation = document.getElementById('notation');
}

function bindUi() {
    dom.searchInput.addEventListener('input', filterPatterns);
    dom.tagInput.addEventListener('input', filterPatterns);
    dom.bpmRange.addEventListener('input', (e) => {
        dom.bpmRangeValue.textContent = e.target.value;
        dom.bpmInput.value = e.target.value;
        state.bpm = Number(e.target.value);
    });
    dom.bpmInput.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (!Number.isFinite(val)) return;
        state.bpm = val;
        dom.bpmRange.value = val;
        dom.bpmRangeValue.textContent = val;
    });
    dom.playBtn.addEventListener('click', playCurrent);
    dom.stopBtn.addEventListener('click', stopPlayback);
    dom.loopToggle.addEventListener('change', (e) => {
        state.isLooping = e.target.checked;
    });
}

// Embedded pattern data (no fetch required)
const EMBEDDED_PATTERNS = [
    {
        "id": "patt_001",
        "title": "Syncopated HH Open Variation",
        "tags": ["8beat", "hihat-open", "permutation"],
        "time_signature": "4/4",
        "bpm_default": 100,
        "loop_length_beats": 4,
        "events": [
            { "time": 0, "note": "kick", "velocity": 110 },
            { "time": 0, "note": "hihat_closed", "velocity": 80 },
            { "time": 0.25, "note": "snare", "velocity": 100 },
            { "time": 0.5, "note": "hihat_open", "velocity": 90 },
            { "time": 0.75, "note": "snare", "velocity": 90 },
            { "time": 1, "note": "kick", "velocity": 110 },
            { "time": 1.5, "note": "hihat_closed", "velocity": 80 },
            { "time": 2, "note": "kick", "velocity": 110 },
            { "time": 2.5, "note": "snare", "velocity": 100 },
            { "time": 3, "note": "kick", "velocity": 110 },
            { "time": 3.5, "note": "snare", "velocity": 100 }
        ],
        "notation": {
            "vexflow": {
                "staves": [
                    {
                        "timeSignature": "4/4",
                        "voices": [
                            {
                                "clef": "percussion",
                                "notes": [
                                    { "keys": ["f/4", "g/5"], "duration": "8" },
                                    { "keys": ["c/5"], "duration": "8" },
                                    { "keys": ["g/5"], "duration": "8" },
                                    { "keys": ["c/5"], "duration": "8" },
                                    { "keys": ["f/4"], "duration": "8" },
                                    { "keys": ["g/5"], "duration": "8" },
                                    { "keys": ["f/4"], "duration": "8" },
                                    { "keys": ["c/5"], "duration": "8" }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    }
];

async function loadPatterns() {
    try {
        const loaded = [];
        for (const pattern of EMBEDDED_PATTERNS) {
            const errors = validatePattern(pattern);
            if (errors.length) {
                console.warn(`Skipping pattern ${pattern.id}`, errors);
                continue;
            }
            loaded.push(pattern);
        }
        state.patterns = loaded;
        state.filtered = loaded;
    } catch (err) {
        console.error('loadPatterns', err);
    }
}

function renderPatternList() {
    dom.patternList.innerHTML = '';
    if (!state.filtered.length) {
        const empty = document.createElement('li');
        empty.textContent = 'No patterns';
        empty.classList.add('muted');
        dom.patternList.appendChild(empty);
        return;
    }
    state.filtered.forEach((pattern) => {
        const li = document.createElement('li');
        li.textContent = pattern.title;
        if (state.currentPattern?.id === pattern.id) {
            li.classList.add('active');
        }
        li.addEventListener('click', () => selectPattern(pattern));
        dom.patternList.appendChild(li);
    });
}

function filterPatterns() {
    const text = dom.searchInput.value.toLowerCase();
    const tags = dom.tagInput.value
        .split(' ')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

    state.filtered = state.patterns.filter((pattern) => {
        const matchTitle = pattern.title.toLowerCase().includes(text);
        const patternTags = (pattern.tags || []).map((t) => t.toLowerCase());
        const matchTags = tags.every((tag) => patternTags.includes(tag));
        return matchTitle && matchTags;
    });
    renderPatternList();
    if (!state.filtered.length) return;
    if (!state.currentPattern || !state.filtered.some((p) => p.id === state.currentPattern.id)) {
        selectPattern(state.filtered[0]);
    }
}

function selectPattern(pattern) {
    state.currentPattern = pattern;
    setBpm(pattern.bpm_default || state.bpm);
    dom.patternTitle.textContent = pattern.title;
    dom.patternTags.textContent = pattern.tags?.join(', ') || '';
    dom.patternDetails.textContent = `Time Sig: ${pattern.time_signature} | Default BPM: ${pattern.bpm_default}`;
    renderNotation(pattern);
    renderPatternList();
}

function renderNotation(pattern) {
    dom.notation.innerHTML = '';
    if (!pattern.notation?.vexflow) {
        dom.notation.textContent = 'Notation data missing';
        return;
    }

    // Wait for VexFlow to load
    if (typeof Vex === 'undefined') {
        dom.notation.textContent = 'Loading notation library...';
        setTimeout(() => renderNotation(pattern), 100);
        return;
    }

    const VF = Vex.Flow;
    const staveData = pattern.notation.vexflow.staves || [];
    const width = pattern.notation.vexflow.width || 640;
    const height = staveData.length * 140 || 160;
    const renderer = new VF.Renderer(dom.notation, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    context.setFont('Arial', 12);

    staveData.forEach((staveInfo, index) => {
        const y = 20 + index * 120;
        const stave = new VF.Stave(10, y, width - 20);
        stave.addClef(staveInfo.clef || 'percussion');
        if (staveInfo.timeSignature) {
            stave.addTimeSignature(staveInfo.timeSignature);
        }
        stave.setContext(context).draw();

        const tsParts = (staveInfo.timeSignature || '4/4').split('/').map(Number);
        const numBeats = tsParts[0] || 4;
        const beatValue = tsParts[1] || 4;

        const voices = (staveInfo.voices || []).map((voiceInfo) => {
            const notes = (voiceInfo.notes || []).map((note) => {
                const staveNote = new VF.StaveNote({
                    clef: voiceInfo.clef || 'percussion',
                    keys: note.keys,
                    duration: note.duration
                });
                if (note.dots) {
                    for (let i = 0; i < note.dots; i += 1) {
                        staveNote.addDotToAll();
                    }
                }
                if (note.articulation) {
                    staveNote.addArticulation(0, new VF.Articulation(note.articulation).setPosition(VF.Modifier.Position.ABOVE));
                }
                return staveNote;
            });

            const voice = new VF.Voice({ num_beats: numBeats, beat_value: beatValue });
            voice.addTickables(notes);
            return voice;
        });

        if (voices.length) {
            new VF.Formatter().joinVoices(voices).format(voices, width - 80);
            voices.forEach((voice) => voice.draw(context, stave));
        }
    });
}

async function playCurrent() {
    if (!state.currentPattern) return;
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
    // Resume AudioContext if suspended (required by browsers)
    if (state.audioCtx.state === 'suspended') {
        await state.audioCtx.resume();
    }
    if (state.isPlaying) {
        stopPlayback();
    }
    state.isPlaying = true;
    schedulePattern(state.currentPattern);
}

function stopPlayback() {
    if (state.scheduler) {
        clearTimeout(state.scheduler);
        state.scheduler = null;
    }
    state.isPlaying = false;
}

function schedulePattern(pattern) {
    if (!pattern.events) return;
    const bpm = state.bpm;
    const secondsPerBeat = 60 / bpm;
    const startTime = state.audioCtx.currentTime + 0.2;
    console.log('Current time:', state.audioCtx.currentTime, 'Start time:', startTime);
    console.log('Scheduling', pattern.events.length, 'events at BPM', bpm);
    pattern.events.forEach((evt) => {
        const velocity = evt.velocity ? evt.velocity / 127 : 0.7;
        const when = startTime + evt.time * secondsPerBeat;
        console.log('Event:', evt.note, 'at time', evt.time, 'beats = absolute', when, 's, velocity', velocity);
        synthesizeDrumSound(evt.note, when, velocity);
    });
    if (state.isLooping) {
        const loopLength = pattern.loop_length_beats || 4;
        const duration = loopLength * secondsPerBeat;
        state.scheduler = setTimeout(() => schedulePattern(pattern), duration * 1000);
    }
}

function synthesizeDrumSound(instrument, startTime, velocity = 0.7) {
    const ctx = state.audioCtx;
    const now = startTime;

    // Normalize instrument name (handle aliases)
    const drumType = normalizeDrumName(instrument);
    console.log('Synthesizing:', instrument, '->', drumType, 'at', startTime);

    switch (drumType) {
        case 'kick':
            synthKick(ctx, now, velocity);
            break;
        case 'snare':
            synthSnare(ctx, now, velocity);
            break;
        case 'hihat_closed':
            synthHiHat(ctx, now, velocity, false);
            break;
        case 'hihat_open':
            synthHiHat(ctx, now, velocity, true);
            break;
        case 'ride':
        case 'ride_bell':
            synthRide(ctx, now, velocity);
            break;
        case 'crash_a':
        case 'crash_b':
            synthCrash(ctx, now, velocity);
            break;
        case 'tom_high':
        case 'tom_mid':
        case 'tom_floor':
            synthTom(ctx, now, velocity, drumType);
            break;
        case 'rim':
            synthRim(ctx, now, velocity);
            break;
        default:
            console.warn('Unknown drum:', instrument);
    }
}

function normalizeDrumName(name) {
    const aliases = {
        'bass': 'kick',
        'bd': 'kick',
        'sn': 'snare',
        'hhc': 'hihat_closed',
        'hho': 'hihat_open',
        'rc': 'ride',
        'rb': 'ride_bell',
        'cr1': 'crash_a',
        'cr2': 'crash_b',
        't1': 'tom_high',
        't2': 'tom_mid',
        'ft': 'tom_floor',
        'rs': 'rim'
    };
    return aliases[name] || name;
}

function synthKick(ctx, time, velocity) {
    console.log('synthKick called', time, velocity);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.05);
    
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
}function synthSnare(ctx, time, velocity) {
    console.log('synthSnare called', time, velocity);
    // Simplified: just use oscillator for now
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
}function synthHiHat(ctx, time, velocity, open = false) {
    console.log('synthHiHat called', time, velocity, open);
    // Simplified: use square wave as placeholder
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, time);
    
    const duration = open ? 0.2 : 0.05;
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
}function synthRide(ctx, time, velocity) {
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, time);
    filter.Q.setValueAtTime(1, time);
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(velocity * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
}

function synthCrash(ctx, time, velocity) {
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(5000, time);
    filter.Q.setValueAtTime(0.5, time);
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(velocity * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
}

function synthTom(ctx, time, velocity, type) {
    const frequencies = {
        'tom_high': 220,
        'tom_mid': 150,
        'tom_floor': 100
    };
    const freq = frequencies[type] || 150;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, time + 0.08);

    gain.gain.setValueAtTime(velocity * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
}

function synthRim(ctx, time, velocity) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(400, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.01);

    gain.gain.setValueAtTime(velocity * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
}

function validatePattern(pattern) {
    const errors = [];
    const required = ['id', 'title', 'time_signature', 'bpm_default', 'events', 'notation'];
    required.forEach((field) => {
        if (pattern[field] === undefined) {
            errors.push(`Missing field: ${field}`);
        }
    });
    if (!Array.isArray(pattern.events) || pattern.events.length === 0) {
        errors.push('events must be a non-empty array');
    } else {
        const maxBeat = pattern.loop_length_beats ?? 4;
        pattern.events.forEach((evt, idx) => {
            if (typeof evt.time !== 'number' || evt.time < 0 || evt.time >= maxBeat) {
                errors.push(`events[${idx}].time invalid`);
            }
            if (!evt.note) {
                errors.push(`events[${idx}].note missing`);
            }
        });
    }
    return errors;
}

function setBpm(value) {
    state.bpm = value;
    dom.bpmInput.value = value;
    dom.bpmRange.value = value;
    dom.bpmRangeValue.textContent = value;
}
