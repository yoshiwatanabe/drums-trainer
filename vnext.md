# Drum Practice Trainer v.Next - MIDI中心アーキテクチャ仕様

## 概要

現在のPOC（Pure JavaScript実装）から、MIDI標準を中心としたPythonベースのアーキテクチャに移行する。
MIDIを共通フォーマットとすることで、音源の柔軟性、外部ツール連携、LLM統合を実現する。

## アーキテクチャ設計

### 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                    フロントエンド (Web UI)                 │
│              HTML/CSS/JavaScript (既存UIベース)            │
└────────────────────┬────────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────────┐
│              バックエンド (Python/FastAPI)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │           パターン管理 (JSON/Database)             │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                   │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │              MIDI生成エンジン                       │  │
│  │           (mido / music21)                        │  │
│  └──────────┬───────────────────────┬────────────────┘  │
│             │                       │                   │
│  ┌──────────▼──────────┐  ┌────────▼─────────────┐    │
│  │   音声生成           │  │   楽譜生成            │    │
│  │  - FluidSynth       │  │  - MusicXML          │    │
│  │  - soundfonts       │  │  - VexFlow JSON      │    │
│  └─────────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### データフロー

```
1. パターン入力
   - 手動作成（JSON）
   - LLM生成（自然言語→JSON）
   
2. MIDI変換
   - JSON → MIDI Note Events
   - ドラムマップ適用 (kick=36, snare=38, etc.)
   
3. 派生生成
   - MIDI → 音声 (WAV/MP3/リアルタイム再生)
   - MIDI → MusicXML → VexFlow (楽譜表示)
   - MIDI → .mid ファイル (ダウンロード)
```

## 技術スタック

### バックエンド (Python)

**Web Framework**
- `FastAPI` - 高速、自動API文書生成、非同期対応

**MIDI処理**
- `mido` - MIDI読み書き、基本操作
- `music21` - 高度な音楽理論、MusicXML変換

**音声生成**
- `fluidsynth` - サウンドフォントベースの音声合成
- `pydub` - 音声ファイル操作（エクスポート用）

**楽譜生成**
- `music21` - MusicXML出力
- カスタムコンバーター - MusicXML → VexFlow JSON

**LLM統合**
- `openai` / `anthropic` - パターン生成
- `langchain` - プロンプトテンプレート管理

**データベース（オプション）**
- `SQLite` - ローカル開発
- `PostgreSQL` - 本番環境
- `SQLAlchemy` - ORM

### フロントエンド

**既存資産活用**
- HTML/CSS/JavaScript（現POCベース）
- VexFlow - 楽譜表示
- Web Audio API - ブラウザ音声再生（軽量プレビュー用）

**新規追加**
- MIDI再生ライブラリ (`@tonejs/midi` + `Tone.js`)
- MIDI/音声ファイルダウンロード機能

## 主要機能仕様

### 1. MIDI生成エンジン

#### 入力フォーマット（JSON）
```json
{
  "id": "pattern_001",
  "title": "Basic Rock Beat",
  "time_signature": "4/4",
  "bpm_default": 120,
  "loop_length_beats": 4,
  "events": [
    { "time": 0.0, "note": "kick", "velocity": 100 },
    { "time": 0.0, "note": "hihat_closed", "velocity": 80 },
    { "time": 0.5, "note": "hihat_closed", "velocity": 80 },
    { "time": 1.0, "note": "snare", "velocity": 100 }
  ]
}
```

#### ドラムマップ（General MIDI準拠）
```python
DRUM_MAP = {
    'kick': 36,           # Bass Drum 1
    'snare': 38,          # Acoustic Snare
    'hihat_closed': 42,   # Closed Hi-Hat
    'hihat_open': 46,     # Open Hi-Hat
    'ride': 51,           # Ride Cymbal 1
    'tom_high': 50,       # High Tom
    'tom_mid': 47,        # Low-Mid Tom
    'tom_low': 45,        # Low Tom
    'crash': 49,          # Crash Cymbal 1
    'crash_ride': 52      # Chinese Cymbal
}
```

#### 出力フォーマット
- **Standard MIDI File (SMF)** - Type 0, Format 1
- **Channel 10** - GMドラム専用チャンネル
- **Ticks Per Beat** - 480 (業界標準)

### 2. 音声生成

#### サウンドフォント方式
```python
from fluidsynth import Synth

def render_audio(midi_file, soundfont_path, output_path):
    """MIDIファイルから音声ファイルを生成"""
    synth = Synth()
    synth.start(driver='file', midi_driver='file')
    sfid = synth.sfload(soundfont_path)  # .sf2ファイル
    synth.program_select(0, sfid, 0, 0)
    synth.play_midi_file(midi_file)
    synth.write_s16_stereo(output_path)
```

#### 推奨サウンドフォント
- **無料**: FluidR3_GM.sf2, GeneralUser GS
- **高品質**: Salamander Grand Piano（ドラム対応版）
- **カスタム**: ユーザー指定可能

#### 出力形式
- WAV (非圧縮)
- MP3 (圧縮、Web配信用)
- リアルタイムストリーミング（ブラウザ再生用）

### 3. 楽譜生成

#### パイプライン
```
MIDI → music21.Stream → MusicXML → VexFlow JSON
```

#### music21による処理
```python
from music21 import converter, stream

def midi_to_musicxml(midi_file):
    """MIDIからMusicXMLを生成"""
    score = converter.parse(midi_file)
    # ドラム譜の調整
    for part in score.parts:
        part.insert(0, clef.PercussionClef())
    return score.write('musicxml')
```

#### VexFlow変換
```python
def musicxml_to_vexflow(musicxml_string):
    """MusicXMLからVexFlow JSON生成"""
    # パースしてVexFlow notation形式に変換
    # ドラム記譜法の特殊処理（符頭形状、位置）
    return {
        "staves": [...],
        "voices": [...],
        "notes": [...]
    }
```

### 4. LLM統合パターン生成

#### プロンプトテンプレート
```python
PATTERN_GENERATION_PROMPT = """
あなたはドラムパターン生成の専門家です。
以下の要求に基づいてドラムパターンをJSON形式で生成してください。

要求: {user_request}
例: "8ビートの基本的なロックビート、BPM120"

制約:
- time_signature: 4/4 固定
- loop_length_beats: 4 (1小節)
- 使用可能な音: kick, snare, hihat_closed, hihat_open, ride
- time: 0.0-3.75の範囲（16分音符単位: 0, 0.25, 0.5, 0.75...）
- velocity: 70-127

出力形式:
{{
  "title": "パターン名",
  "bpm_default": 120,
  "events": [
    {{"time": 0.0, "note": "kick", "velocity": 100}},
    ...
  ]
}}
"""
```

#### バリデーション
```python
def validate_llm_pattern(pattern):
    """LLM生成パターンの検証"""
    # 必須フィールドチェック
    # time範囲チェック (0.0 <= time < 4.0)
    # velocity範囲チェック (0 <= velocity <= 127)
    # note名チェック（DRUM_MAPに存在）
    # 時間順ソート
    return validated_pattern
```

### 5. REST API設計

#### エンドポイント

**パターン管理**
```
GET    /api/patterns          # パターン一覧取得
GET    /api/patterns/{id}     # パターン詳細取得
POST   /api/patterns          # パターン作成
PUT    /api/patterns/{id}     # パターン更新
DELETE /api/patterns/{id}     # パターン削除
```

**MIDI生成・変換**
```
POST   /api/patterns/{id}/midi        # MIDI生成
POST   /api/patterns/{id}/audio       # 音声生成 (WAV/MP3)
POST   /api/patterns/{id}/musicxml    # MusicXML生成
POST   /api/patterns/{id}/notation    # VexFlow JSON生成
```

**LLM統合**
```
POST   /api/generate/pattern          # LLMでパターン生成
POST   /api/generate/variation        # 既存パターンのバリエーション生成
```

**ファイルダウンロード**
```
GET    /api/patterns/{id}/download/midi
GET    /api/patterns/{id}/download/audio?format=mp3
GET    /api/patterns/{id}/download/musicxml
```

#### レスポンス例
```json
{
  "id": "pattern_001",
  "title": "Basic Rock Beat",
  "bpm_default": 120,
  "midi_url": "/static/midi/pattern_001.mid",
  "audio_url": "/static/audio/pattern_001.mp3",
  "notation": {
    "vexflow": { ... },
    "musicxml_url": "/static/xml/pattern_001.xml"
  }
}
```

## プロジェクト構成

```
drums-trainer-vnext/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPIアプリケーション
│   │   ├── models.py               # データモデル（Pydantic）
│   │   ├── database.py             # DB接続
│   │   ├── routers/
│   │   │   ├── patterns.py         # パターンAPI
│   │   │   ├── midi.py             # MIDI生成API
│   │   │   ├── llm.py              # LLM統合API
│   │   │   └── download.py         # ファイルダウンロードAPI
│   │   ├── services/
│   │   │   ├── midi_generator.py   # MIDI生成ロジック
│   │   │   ├── audio_renderer.py   # 音声生成
│   │   │   ├── notation_converter.py # 楽譜変換
│   │   │   └── llm_client.py       # LLMクライアント
│   │   └── utils/
│   │       ├── drum_map.py         # ドラムマップ定義
│   │       └── validators.py       # バリデーション
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js                      # API呼び出し、UI制御
│   └── lib/
│       └── vexflow.js
├── soundfonts/                     # サウンドフォント
│   └── FluidR3_GM.sf2
├── data/                           # 永続化データ
│   ├── patterns/                   # JSONパターン
│   └── generated/                  # 生成ファイル
│       ├── midi/
│       ├── audio/
│       └── musicxml/
├── docker-compose.yml
├── README.md
└── vnext.md                        # 本仕様書
```

## 実装フェーズ

### Phase 1: 基盤構築
- [ ] FastAPIセットアップ
- [ ] MIDI生成エンジン実装（mido）
- [ ] 基本的なREST API（CRUD）
- [ ] 既存3パターンのMIDI変換確認

### Phase 2: 音声・楽譜生成
- [ ] FluidSynthによる音声生成
- [ ] サウンドフォント選択機能
- [ ] music21統合（MusicXML生成）
- [ ] VexFlow JSONコンバーター

### Phase 3: フロントエンド統合
- [ ] 既存UIのAPI接続
- [ ] MIDI/音声再生機能
- [ ] ファイルダウンロード機能
- [ ] パターンアップロード機能

### Phase 4: LLM統合
- [ ] OpenAI/Anthropic APIクライアント
- [ ] プロンプトエンジニアリング
- [ ] パターン生成UI
- [ ] バリエーション生成機能

### Phase 5: 高度な機能
- [ ] データベース永続化
- [ ] ユーザー認証（オプション）
- [ ] パターン共有機能
- [ ] 練習ログ・進捗管理
- [ ] Docker化・デプロイ

## 移行戦略

### 既存POCとの共存
1. 現POC（`index.html`, `app.js`, `style.css`）はそのまま保持
2. v.Nextは新ディレクトリで開発（`vnext/`）
3. 完成後、段階的に移行

### データ移行
- 既存 `EMBEDDED_PATTERNS` → JSON ファイル化
- JSON → MIDIへ一括変換
- 楽譜データは自動生成で置き換え（VexFlow手書きJSON不要に）

## メリットまとめ

1. **標準化**: MIDI業界標準により互換性向上
2. **拡張性**: 新機能追加が容易（音源変更、楽器追加）
3. **品質**: サウンドフォントで高品質音声
4. **連携**: DAW、楽譜ソフトとの相互運用
5. **自動化**: LLM統合でパターン生成・楽譜作成が自動
6. **保守性**: Python エコシステムの豊富なライブラリ

## 参考リソース

### ライブラリ
- [mido](https://mido.readthedocs.io/) - MIDI処理
- [music21](http://web.mit.edu/music21/) - 音楽理論・変換
- [FluidSynth](https://www.fluidsynth.org/) - 音声合成
- [FastAPI](https://fastapi.tiangolo.com/) - Webフレームワーク

### ドラム記譜
- [General MIDI Drum Map](https://www.midi.org/specifications/item/gm-level-1-sound-set)
- [VexFlow Percussion](https://github.com/0xfe/vexflow/wiki/Percussion-Notation)

### サウンドフォント
- [FluidR3_GM](http://www.musescore.org/download/fluid-soundfont.tar.gz)
- [GeneralUser GS](http://schristiancollins.com/generaluser.php)
