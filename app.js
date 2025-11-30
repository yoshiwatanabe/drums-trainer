// Drum Practice Trainer - Group-based UI with lazy loading

const state = {
    audioCtx: null,
    groups: [],
    loadedPatterns: {}, // groupId -> patterns array
    currentPage: null,
    bpm: 70,
    isLooping: true,
    playingPatterns: new Set(), // Set of pattern IDs currently playing
    sampleMap: null,
    audioBuffers: {}
};

const dom = {};
const DATA_BASE_URL = 'https://yoshiwatanabe.github.io/drums-trainer-data';
const PATTERNS_PER_PAGE = 8;

window.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    cacheDom();
    bindUi();
    setBpm(70);
    showLoading('Loading audio samples...');
    await loadAudioSamples();
    showLoading('Loading pattern index...');
    await loadIndex();
    renderGroupList();
    hideLoading();
}

function cacheDom() {
    dom.groupList = document.getElementById('groupList');
    dom.patternsGrid = document.getElementById('patternsGrid');
    dom.loadingIndicator = document.getElementById('loadingIndicator');
    dom.bpmInput = document.getElementById('bpmInput');
    dom.bpmRange = document.getElementById('bpmRange');
    dom.bpmValue = document.getElementById('bpmValue');
    dom.loopToggle = document.getElementById('loopToggle');
}

function bindUi() {
    dom.bpmRange.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        setBpm(val);
    });
    dom.bpmInput.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (Number.isFinite(val)) {
            setBpm(val);
        }
    });
    dom.loopToggle.addEventListener('change', (e) => {
        state.isLooping = e.target.checked;
    });
}

function setBpm(value) {
    state.bpm = value;
    dom.bpmInput.value = value;
    dom.bpmRange.value = value;
    dom.bpmValue.textContent = value;
}

async function loadAudioSamples() {
    try {
        const mapResponse = await fetch('audio/sample-map.json');
        if (!mapResponse.ok) {
            console.error('Failed to load sample-map.json');
            return;
        }
        state.sampleMap = await mapResponse.json();

        if (!state.audioCtx) {
            state.audioCtx = new AudioContext();
        }

        const loadPromises = [];
        for (const [key, sample] of Object.entries(state.sampleMap)) {
            const loadPromise = fetch(sample.file)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => state.audioCtx.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    state.audioBuffers[key] = audioBuffer;
                })
                .catch(err => {
                    console.warn(`Failed to load ${sample.file}:`, err);
                });
            loadPromises.push(loadPromise);
        }

        await Promise.all(loadPromises);
        console.log(`Audio samples loaded: ${Object.keys(state.audioBuffers).length} sounds`);
    } catch (error) {
        console.error('Error loading audio samples:', error);
    }
}

async function loadIndex() {
    try {
        let indexResponse;
        if (DATA_BASE_URL) {
            indexResponse = await fetch(`${DATA_BASE_URL}/patterns/index.json`);
        } else {
            indexResponse = await fetch('patterns/index.json');
        }

        if (!indexResponse.ok) {
            console.error('Failed to load index.json');
            return;
        }

        const indexData = await indexResponse.json();

        // Check version
        if (indexData.version && indexData.version.startsWith("2.") && indexData.groups) {
            state.groups = indexData.groups;
            console.log(`Loaded ${state.groups.length} groups`);
        } else {
            console.error('Unsupported index.json format');
        }
    } catch (error) {
        console.error('Error loading index:', error);
    }
}

function renderGroupList() {
    dom.groupList.innerHTML = '';

    state.groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group';

        const numPages = Math.ceil(group.patterns.length / PATTERNS_PER_PAGE);

        const headerDiv = document.createElement('div');
        headerDiv.className = 'group-header';
        headerDiv.innerHTML = `
            <span class="group-title">${group.name}</span>
            <span class="group-count">${group.patterns.length} patterns</span>
        `;

        headerDiv.addEventListener('click', () => {
            groupDiv.classList.toggle('expanded');
        });

        const pagesDiv = document.createElement('div');
        pagesDiv.className = 'group-pages';

        for (let i = 0; i < numPages; i++) {
            const start = i * PATTERNS_PER_PAGE;
            const end = Math.min(start + PATTERNS_PER_PAGE, group.patterns.length);
            const pageBtn = document.createElement('button');
            pageBtn.className = 'page-btn';
            pageBtn.textContent = `Page ${i + 1} (${start + 1}-${end})`;
            pageBtn.addEventListener('click', () => loadGroupPage(group, i));
            pagesDiv.appendChild(pageBtn);
        }

        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(pagesDiv);
        dom.groupList.appendChild(groupDiv);
    });
}

async function loadGroupPage(group, pageIndex) {
    // Load patterns if not already loaded
    if (!state.loadedPatterns[group.id]) {
        showLoading(`Loading ${group.title}...`);
        await loadGroupPatterns(group);
        hideLoading();
    }

    const patterns = state.loadedPatterns[group.id];
    const start = pageIndex * PATTERNS_PER_PAGE;
    const end = Math.min(start + PATTERNS_PER_PAGE, patterns.length);
    const pagePatterns = patterns.slice(start, end);

    state.currentPage = { group, pageIndex, patterns: pagePatterns };

    renderPatternsGrid(pagePatterns);

    // Update active state
    document.querySelectorAll('.page-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.group-header').forEach(h => h.classList.remove('loaded'));
    document.querySelectorAll('.group').forEach(g => g.classList.remove('expanded'));

    const groupDiv = [...dom.groupList.children].find(div =>
        div.querySelector('.group-title').textContent === group.title
    );
    if (groupDiv) {
        groupDiv.classList.add('expanded');
        groupDiv.querySelector('.group-header').classList.add('loaded');
        groupDiv.querySelectorAll('.page-btn')[pageIndex].classList.add('active');
    }
}

async function loadGroupPatterns(group) {
    const patterns = [];
    const cacheBuster = Date.now(); // Force cache refresh

    for (const filename of group.patterns) {
        try {
            let patternResponse;
            if (DATA_BASE_URL) {
                patternResponse = await fetch(`${DATA_BASE_URL}/patterns/${filename}?v=${cacheBuster}`);
            } else {
                patternResponse = await fetch(`patterns/${filename}?v=${cacheBuster}`);
            }

            if (patternResponse.ok) {
                const pattern = await patternResponse.json();
                patterns.push(pattern);
            }
        } catch (error) {
            console.warn(`Failed to load ${filename}:`, error);
        }
    }

    state.loadedPatterns[group.id] = patterns;
    console.log(`Loaded ${patterns.length} patterns for group ${group.id}`);
}

function renderPatternsGrid(patterns) {
    dom.patternsGrid.innerHTML = '';

    patterns.forEach(pattern => {
        const card = createPatternCard(pattern);
        dom.patternsGrid.appendChild(card);
    });
}

function createPatternCard(pattern) {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    card.dataset.patternId = pattern.id;

    const header = document.createElement('div');
    header.className = 'pattern-header';

    const title = document.createElement('h3');
    title.className = 'pattern-title';
    title.textContent = pattern.title;

    const controls = document.createElement('div');
    controls.className = 'pattern-controls';

    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => togglePlayPattern(pattern, playBtn));

    controls.appendChild(playBtn);
    header.appendChild(title);
    header.appendChild(controls);

    // Add pattern description/analysis
    const description = analyzePattern(pattern);
    if (description) {
        const descDiv = document.createElement('div');
        descDiv.className = 'pattern-description';
        descDiv.textContent = description;
        card.appendChild(header);
        card.appendChild(descDiv);
    } else {
        card.appendChild(header);
    }

    const notationDiv = document.createElement('div');
    notationDiv.className = 'pattern-notation';
    notationDiv.id = `notation-${pattern.id}`;

    // Add legend
    const legend = document.createElement('div');
    legend.className = 'notation-legend';
    legend.innerHTML = `
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #e74c3c;"></span>
            <span>キック</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #3498db;"></span>
            <span>スネア</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #95a5a6;"></span>
            <span>ゴースト</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #f39c12;"></span>
            <span>HH クローズ</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #ff9500;"></span>
            <span>HH オープン</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #9b59b6;"></span>
            <span>ハイタム</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #1abc9c;"></span>
            <span>ミッドタム</span>
        </div>
        <div class="notation-legend-item">
            <span class="notation-legend-color" style="background: #e67e22;"></span>
            <span>フロアタム</span>
        </div>
    `;
    notationDiv.appendChild(legend);

    card.appendChild(notationDiv);

    // Render notation
    requestAnimationFrame(() => {
        renderNotation(pattern, notationDiv);
    });

    return card;
}

function analyzePattern(pattern) {
    if (!pattern.events) return null;

    const features = [];

    // Count kicks, snares, and analyze timing
    const kicks = pattern.events.filter(e => e.note === 'kick');
    const snares = pattern.events.filter(e => e.note === 'snare');
    const ghostNotes = pattern.events.filter(e => e.velocity < 70);
    const hihatOpen = pattern.events.filter(e => e.note === 'hihat_open');
    const hihatClosed = pattern.events.filter(e => e.note === 'hihat_closed');
    const tomHigh = pattern.events.filter(e => e.note === 'tom_high');
    const tomMid = pattern.events.filter(e => e.note === 'tom_mid');
    const tomFloor = pattern.events.filter(e => e.note === 'tom_floor');

    // Check for roll patterns (snare + toms in sequence)
    const allToms = [...tomHigh, ...tomMid, ...tomFloor];
    const tomAndSnare = [...snares, ...allToms].sort((a, b) => a.time - b.time);

    // Detect roll: 3+ consecutive tom/snare hits after beat 2
    const rollEvents = tomAndSnare.filter(e => e.time >= 1.5);
    if (rollEvents.length >= 3) {
        const tomTypes = new Set([
            tomHigh.length > 0 ? 'high' : null,
            tomMid.length > 0 ? 'mid' : null,
            tomFloor.length > 0 ? 'floor' : null
        ].filter(Boolean));

        if (tomTypes.size === 3) {
            features.push(`🎼 3タムロール（スネア→ハイ→ミッド→フロア）`);
        } else if (tomTypes.size === 2) {
            features.push(`🎼 2タムロール（${rollEvents.length}ヒット）`);
        } else if (allToms.length > 0) {
            features.push(`🎼 シングルタムロール（${rollEvents.length}ヒット）`);
        } else {
            features.push(`🎼 スネアロール（${rollEvents.length}ヒット）`);
        }
    } else if (allToms.length > 0) {
        // Tom fills (not a roll, just tom hits)
        const tomCount = tomHigh.length + tomMid.length + tomFloor.length;
        if (tomHigh.length > 0 && tomMid.length > 0 && tomFloor.length > 0) {
            features.push(`🥁 3タムフィル（${tomCount}ヒット）`);
        } else if ((tomHigh.length > 0 && tomMid.length > 0) ||
            (tomMid.length > 0 && tomFloor.length > 0) ||
            (tomHigh.length > 0 && tomFloor.length > 0)) {
            features.push(`🥁 2タムフィル（${tomCount}ヒット）`);
        } else {
            features.push(`🥁 シングルタムフィル（${tomCount}ヒット）`);
        }
    }

    // Check for syncopation (notes on offbeats)
    const offbeatNotes = pattern.events.filter(e => {
        const t = e.time;
        // Check if on 16th note offbeats (0.125, 0.375, 0.625, 0.875, etc.)
        const mod = (t * 4) % 1;
        return mod > 0.1 && mod < 0.9 && (e.note === 'kick' || e.note === 'snare');
    });

    // Only show kick density if no toms (to avoid cluttering tom patterns)
    if (allToms.length === 0) {
        if (kicks.length >= 5) {
            features.push(`🥁 ${kicks.length}回のキック（高密度）`);
        } else if (kicks.length >= 3) {
            features.push(`🥁 ${kicks.length}回のキック`);
        } else if (kicks.length > 0) {
            features.push(`🥁 ${kicks.length}回のキック（スパース）`);
        }
    }

    // Ghost notes
    if (ghostNotes.length > 0) {
        features.push(`👻 ゴーストノート ${ghostNotes.length}個`);
    }

    // Syncopation
    if (offbeatNotes.length >= 2) {
        features.push(`🎵 シンコペーション（${offbeatNotes.length}箇所）`);
    }

    // Backbeat check (only if no roll detected)
    if (rollEvents.length < 3) {
        const backbeatSnares = snares.filter(s => {
            const beat = Math.round(s.time);
            return beat === 1 || beat === 3; // 2nd and 4th beats
        });

        if (backbeatSnares.length === 2) {
            features.push(`✓ バックビート（2・4拍目）`);
        } else if (backbeatSnares.length > 0) {
            features.push(`⚠ 変則バックビート`);
        }
    }

    // Hihat variations
    if (hihatOpen.length > 0) {
        features.push(`🔓 オープンHH ${hihatOpen.length}回`);
    }

    return features.length > 0 ? features.join(' · ') : null;
}

function renderNotation(pattern, container) {
    if (!pattern.notation || !pattern.notation.vexflow) return;

    const VF = Vex.Flow;
    const vfData = pattern.notation.vexflow;

    container.innerHTML = '';
    const width = container.offsetWidth || 500;
    const height = 180;

    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    vfData.staves.forEach((staveDef, index) => {
        const stave = new VF.Stave(10, 10, width - 20);

        if (staveDef.timeSignature) {
            stave.addTimeSignature(staveDef.timeSignature);
        }

        stave.setContext(context).draw();

        const voices = staveDef.voices.map((voiceDef) => {
            const clef = voiceDef.clef || 'treble';
            let noteIndex = 0;

            const notes = voiceDef.notes.map((note) => {
                if (note.duration && note.duration.includes('r')) {
                    noteIndex++;
                    return new VF.StaveNote({
                        keys: note.keys || ['b/4'],
                        duration: note.duration,
                        clef: clef
                    });
                } else {
                    const staveNote = new VF.StaveNote({
                        keys: note.keys,
                        duration: note.duration,
                        clef: clef
                    });

                    // Get events at this time position (8th notes = 0.5 intervals)
                    const timePosition = noteIndex * 0.5;
                    const eventsAtTime = pattern.events.filter(e => Math.abs(e.time - timePosition) < 0.26);

                    // Color code notes by instrument
                    note.keys.forEach((key, keyIndex) => {
                        if (key === 'f/4') { // kick
                            staveNote.setKeyStyle(keyIndex, { fillStyle: '#e74c3c', strokeStyle: '#c0392b' });
                        } else if (key === 'c/5') { // snare
                            const snareEvent = eventsAtTime.find(e => e.note === 'snare');
                            if (snareEvent && snareEvent.velocity < 70) {
                                // Ghost note - lighter color
                                staveNote.setKeyStyle(keyIndex, { fillStyle: '#95a5a6', strokeStyle: '#7f8c8d' });
                            } else {
                                staveNote.setKeyStyle(keyIndex, { fillStyle: '#3498db', strokeStyle: '#2980b9' });
                            }
                        } else if (key === 'g/5') { // hihat
                            const hihatOpen = eventsAtTime.find(e => e.note === 'hihat_open');
                            const hihatClosed = eventsAtTime.find(e => e.note === 'hihat_closed');

                            if (hihatOpen) {
                                // Open hihat - brighter orange, use + articulation as "open" marker
                                staveNote.setKeyStyle(keyIndex, { fillStyle: '#ff9500', strokeStyle: '#e67e00' });
                                try {
                                    // Use "+" articulation above the note to indicate open hihat
                                    staveNote.addModifier(new VF.Articulation('a+').setPosition(4), keyIndex);
                                } catch (e) {
                                    console.log('Could not add articulation:', e);
                                }
                            } else if (hihatClosed) {
                                // Closed hihat - standard orange
                                staveNote.setKeyStyle(keyIndex, { fillStyle: '#f39c12', strokeStyle: '#d68910' });
                            } else {
                                // Default
                                staveNote.setKeyStyle(keyIndex, { fillStyle: '#f39c12', strokeStyle: '#d68910' });
                            }
                        } else if (key === 'd/5') { // tom high
                            staveNote.setKeyStyle(keyIndex, { fillStyle: '#9b59b6', strokeStyle: '#8e44ad' });
                        } else if (key === 'b/4') { // tom mid
                            staveNote.setKeyStyle(keyIndex, { fillStyle: '#1abc9c', strokeStyle: '#16a085' });
                        } else if (key === 'a/4') { // tom floor
                            staveNote.setKeyStyle(keyIndex, { fillStyle: '#e67e22', strokeStyle: '#d35400' });
                        }
                    });

                    // Add accent for high velocity notes
                    const highVelocityEvent = eventsAtTime.find(e =>
                        (e.note === 'kick' || e.note === 'snare') && e.velocity >= 100
                    );
                    if (highVelocityEvent) {
                        staveNote.addModifier(new VF.Articulation('a>').setPosition(3), 0);
                    }

                    noteIndex++;
                    return staveNote;
                }
            });

            const time = voiceDef.time || { num_beats: 4, beat_value: 4 };
            const voice = new VF.Voice(time);
            voice.addTickables(notes);
            return voice;
        });

        if (voices.length) {
            new VF.Formatter().joinVoices(voices).format(voices, width - 80);
            voices.forEach((voice) => voice.draw(context, stave));
        }
    });
}

async function togglePlayPattern(pattern, playBtn) {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }

    if (state.audioCtx.state === 'suspended') {
        await state.audioCtx.resume();
    }

    if (state.playingPatterns.has(pattern.id)) {
        stopPattern(pattern.id);
        playBtn.textContent = 'Play';
        playBtn.classList.remove('playing');
    } else {
        playPattern(pattern);
        playBtn.textContent = 'Stop';
        playBtn.classList.add('playing');
    }
}

function playPattern(pattern) {
    if (!pattern.events) return;

    state.playingPatterns.add(pattern.id);
    schedulePattern(pattern);
}

function stopPattern(patternId) {
    state.playingPatterns.delete(patternId);
}

function schedulePattern(pattern) {
    if (!state.playingPatterns.has(pattern.id)) return;

    const bpm = state.bpm;
    const secondsPerBeat = 60 / bpm;
    const startTime = state.audioCtx.currentTime + 0.1;

    // Track open hihat sources to stop them when closed hihat plays
    const openHihatSources = [];

    pattern.events.forEach((evt) => {
        const velocity = evt.velocity ? evt.velocity / 127 : 0.7;
        const when = startTime + evt.time * secondsPerBeat;

        // Stop any playing open hihat when closed hihat is hit
        if (evt.note === 'hihat_closed') {
            openHihatSources.forEach(src => {
                if (src.stopTime > when) {
                    src.source.stop(when);
                }
            });
        }

        const hihatSource = synthesizeDrumSound(evt.note, when, velocity);
        if (evt.note === 'hihat_open' && hihatSource) {
            openHihatSources.push(hihatSource);
        }
    });

    if (state.isLooping) {
        const loopLength = pattern.loop_length_beats || 4;
        const duration = loopLength * secondsPerBeat;
        setTimeout(() => schedulePattern(pattern), duration * 1000);
    } else {
        setTimeout(() => {
            state.playingPatterns.delete(pattern.id);
            const playBtn = document.querySelector(`[data-pattern-id="${pattern.id}"] .play-btn`);
            if (playBtn) {
                playBtn.textContent = 'Play';
                playBtn.classList.remove('playing');
            }
        }, (pattern.loop_length_beats || 4) * secondsPerBeat * 1000);
    }
}

function synthesizeDrumSound(instrument, startTime, velocity = 0.7) {
    const drumType = normalizeDrumName(instrument);

    if (state.audioBuffers[drumType]) {
        return playSample(drumType, startTime, velocity);
    }

    console.warn(`No sample for ${drumType}, using synthesis fallback`);
    const ctx = state.audioCtx;
    switch (drumType) {
        case 'kick':
            synthKick(ctx, startTime, velocity);
            break;
        case 'snare':
            synthSnare(ctx, startTime, velocity);
            break;
        case 'hihat_closed':
            synthHiHat(ctx, startTime, velocity, false);
            break;
        case 'hihat_open':
            return synthHiHat(ctx, startTime, velocity, true);
        default:
            console.warn('Unknown drum:', instrument);
    }
    return null;
}

function playSample(drumType, startTime, velocity = 0.7) {
    const ctx = state.audioCtx;
    const buffer = state.audioBuffers[drumType];

    if (!buffer) return null;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;

    let volumeAdjustment = 0;
    if (state.sampleMap && state.sampleMap[drumType]) {
        volumeAdjustment = state.sampleMap[drumType].velocityTrim || 0;
    }

    const baseGain = velocity;
    const trimMultiplier = Math.pow(10, volumeAdjustment / 20);
    gainNode.gain.value = baseGain * trimMultiplier;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(startTime);

    // Return source and planned stop time for open hihat tracking
    const stopTime = drumType === 'hihat_open' ? startTime + buffer.duration : startTime + 0.1;
    return { source, stopTime };
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

// Synthesis fallbacks (simplified versions)
function synthKick(ctx, time, velocity) {
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
}

function synthSnare(ctx, time, velocity) {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
}

function synthHiHat(ctx, time, velocity, open) {
    const bufferSize = ctx.sampleRate * (open ? 0.5 : 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.5 : 0.05));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
}

// UI Helper functions
function showLoading(message = 'Loading...') {
    if (dom.loadingIndicator) {
        const messageEl = dom.loadingIndicator.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
        dom.loadingIndicator.classList.remove('hidden');
        dom.patternsGrid.style.display = 'none';
    }
}

function hideLoading() {
    if (dom.loadingIndicator) {
        dom.loadingIndicator.classList.add('hidden');
        dom.patternsGrid.style.display = 'grid';
    }
}
