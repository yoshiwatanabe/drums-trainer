// Drum Practice Trainer - MVP scaffolding

const state = {
    audioCtx: null,
    audioMap: {},
    audioLookup: new Map(),
    buffers: {},
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
    await loadAudioMap();
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

async function loadAudioMap() {
    const res = await fetch('audio/sample-map.json');
    if (!res.ok) {
        console.error('Failed to fetch audio map');
        return;
    }
    state.audioMap = await res.json();
    state.audioLookup = buildAudioLookup(state.audioMap);
}

async function loadPatterns() {
    try {
        const manifestRes = await fetch('patterns/index.json');
        if (!manifestRes.ok) {
            console.error('patterns/index.json missing');
            return;
        }
        const manifest = await manifestRes.json();
        const loaded = [];
        for (const entry of manifest) {
            const file = entry.file || entry.path;
            if (!file) continue;
            try {
                const res = await fetch(file);
                if (!res.ok) {
                    console.warn(`Failed to fetch pattern ${file}`);
                    continue;
                }
                const pattern = await res.json();
                const errors = validatePattern(pattern);
                if (errors.length) {
                    console.warn(`Skipping pattern ${pattern.id || file}`, errors);
                    continue;
                }
                loaded.push(pattern);
            } catch (err) {
                console.warn('Pattern load error', file, err);
            }
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
    if (state.isPlaying) {
        stopPlayback();
    }
    state.isPlaying = true;
    await ensureBuffersLoaded();
    schedulePattern(state.currentPattern);
}

function stopPlayback() {
    if (state.scheduler) {
        clearTimeout(state.scheduler);
        state.scheduler = null;
    }
    state.isPlaying = false;
}

async function ensureBuffersLoaded() {
    const entries = Object.entries(state.audioMap);
    for (const [key, info] of entries) {
        if (state.buffers[key]) continue;
        const res = await fetch(info.file);
        const arrayBuffer = await res.arrayBuffer();
        state.buffers[key] = await state.audioCtx.decodeAudioData(arrayBuffer.slice(0));
    }
}

function schedulePattern(pattern) {
    if (!pattern.events) return;
    const bpm = state.bpm;
    const secondsPerBeat = 60 / bpm;
    const startTime = state.audioCtx.currentTime + 0.1;
    pattern.events.forEach((evt) => {
        const sound = getBufferForNote(evt.note);
        if (!sound) return;
        const { buffer, infoKey } = sound;
        const source = state.audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = state.audioCtx.createGain();
        const vel = evt.velocity ? evt.velocity / 127 : 1;
        const trimDb = state.audioMap[infoKey]?.velocityTrim || 0;
        const trim = Math.pow(10, trimDb / 20);
        gain.gain.value = vel * trim;
        source.connect(gain).connect(state.audioCtx.destination);
        const when = startTime + evt.time * secondsPerBeat;
        source.start(when);
    });
    if (state.isLooping) {
        const loopLength = pattern.loop_length_beats || 4;
        const duration = loopLength * secondsPerBeat;
        state.scheduler = setTimeout(() => schedulePattern(pattern), duration * 1000);
    }
}

function buildAudioLookup(map) {
    const lookup = new Map();
    Object.entries(map).forEach(([key, info]) => {
        lookup.set(key, key);
        (info.aliases || []).forEach((alias) => lookup.set(alias, key));
    });
    return lookup;
}

function getBufferForNote(note) {
    const key = state.audioLookup.get(note) || note;
    const buffer = state.buffers[key];
    if (!buffer) return null;
    return { buffer, infoKey: key };
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
