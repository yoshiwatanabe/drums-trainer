
# **Drum Practice Web App — Specification Document**

このドキュメントは、VS Code + GitHub Copilot Agent mode に渡すための
**「ドラム練習支援 Web アプリ」の仕様書**です。
実装コードはこの仕様に基づいて Copilot に生成させます。

---

# 1. プロジェクト概要

本プロジェクトは、ドラム初心者が
**多様なリズム・アクセント・ハイハット開閉・スネア、ベースドラム、シンバルの位置などの permutation（変化形）を体系的に練習できる Web アプリ**
を JavaScript ベースで構築することを目的とする。

一般的な 8 ビートや 16 ビートの練習ではなく、
**“楽曲中で時々出てくる特殊なパターン”に強くなること**
を目指す。

さらに、

* **音を聴きながらパターンを確認する（MIDI/サンプル再生）**
* **譜面として視覚的に確認する（VexFlow）**
* **タグつきのパターンカタログとして保存し、後から引き出せるようにする**

という 3 つの目的を満たす構造とする。

---

# 2. 背景と開発の意図

## 2.1 音楽的背景（ユーザーの練習目的）

ユーザーはドラム初心者であり、以下の課題意識をもつ：

* 基本ビートだけ練習しても、
  **アクセント位置・ハイハット開閉位置・スネアの変則位置** など
  「少しズレたパターン」で崩れやすい。
* そのため日常的に **多様な permutation を練習**する必要がある。
* 楽譜として見慣れておくことで、楽曲中の「見覚えのあるパターン」を
  **譜読みで recall できるようにしたい**。

このアプリは、
**“音で聴き、譜面で確認し、筋肉と頭に両方記憶させる”**
という目的を支援する。

## 2.2 技術的背景

* LLM を使ってオフラインで練習パターンを大量生成したい
* パターンは JSON として保存し Git で管理したい
* アプリは **JavaScript (WebAudio + VexFlow)** で軽量に実装したい
* ブラウザで複雑なインストールなしに走らせたい
* PDF は不要。ブラウザ印刷で代替できる

---

# 3. 想定するユースケース

## 3.1 基本フロー（OFFLINE LLM → 練習）

1. ユーザーが ChatGPT に
   **「HH オープンの位置が違う 8 ビートのバリエーションを 10 個作って」**
   のように依頼
2. LLM が

   * MIDI 用の `events` JSON
   * 譜面用の `notation`（VexFlow）
   * タグ情報（genre, difficulty, etc.）
     をまとめた JSON を生成
3. それを `patterns/*.json` に保存（Git 管理）
4. Web アプリで

   * 音（WebAudio）
   * 譜面（VexFlow）
     を確認しながら練習

## 3.2 練習時の具体的な操作

* パターン一覧から選ぶ
* BPM を調整
* 再生（ループあり/なし）
* 譜面を確認
* 気に入ったらパターンを印刷（またはPDF印刷）

---

# 4. 技術スタック

* **JavaScript (ES6)**
* **WebAudio API**: ドラム音再生
* **VexFlow**: ドラム譜レンダリング
* **HTML/CSS**
* **JSON**: パターン定義およびカタログ
* **Git/GitHub**: パターンの保存・共有

フレームワーク（React 等）は使用しない。
軽量・シンプル・学習目的優先。

---

# 5. フォルダ構成（初期構成案）

```
project-root/
  index.html
  app.js
  style.css

  /audio (examples)
    kick.wav
    snare.wav
    hihat_closed.wav
    hihat_open.wav

  /patterns
    example_001.json
    example_002.json

  /lib
    vexflow.js

  README.md
```

---

# 6. パターン JSON 仕様

LLM が生成し、Git に保存していく基本データ形式。

```json
{
  "id": "patt_001",
  "title": "Syncopated HH Open Variation",
  "tags": ["8beat", "hihat-open", "permutation"],
  "time_signature": "4/4",
  "bpm_default": 100,


## 6.1 タイミングと小節長

* `time` は 1 拍を 1.0 とする相対値で記録する。16 分刻みは 0.25、3 連は 1/3 等、浮動小数で表現する。
* `loop_length_beats` フィールドを追加し、1 パターンが何拍で構成されるかを明示する。例: 4 小節=16 拍。
* 複数小節に跨る場合も `time` は 0 から `loop_length_beats` 未満でモジュロ計算し、ループ再生時は `time + n * loop_length_beats` でスケジューリングする。

## 6.2 BPM と実時間変換

* 実時間は `seconds = (60 / bpm_current) * time` で算出する。
* ループ再生では WebAudio の lookahead (e.g. 0.1s) を使い、`performance.now()` 基準で先行してイベントを enqueue する。
* `bpm_default` から ±40 の範囲で UI から調整できる前提でテストする。

## 6.3 `notation.vexflow` テンプレート

最低限の項目例:

```json
{
  "staves": [
    {
      "timeSignature": "4/4",
      "voices": [
        {
          "clef": "percussion",
          "notes": [
            {"keys": ["c/5"], "duration": "16", "articulation": "accent"}
          ]
        }
      ],
      "annotations": {
        "hihat": "open", "stickings": ["R", "L", ...]
      }
    }
  ]
}
```

* `keys` には Drumset 用の VexFlow ノーテーション (例: kick = "f/3", snare = "c/4") を使う。
* ハイハット開閉は `articulation` または `annotations.hihat` に `open`/`closed` を入れて描画時にシンボルを切り替える。
* LLM がテンプレに従ってデータを埋めやすいよう、上記構造を spec.md に保持する。

## 6.4 データ拡張フィールド

* `metadata.practice_focus`: 例 `"syncopated snare"`。目的別に検索するための自由記述。
* `swing_ratio`: 0.0 (ストレート)〜1.0 (完全スウィング) を将来用に予約。未指定時は 0。
* 追加フィールドは後方互換性のためデフォルト値を明記し、アプリ側が安全に無視できるよう設計する。

# 7. オーディオサンプル要件

* フォーマット: WAV, 44.1kHz, 16bit, モノラル推奨。音量が揃うように -6dBFS 付近で正規化する。
* ファイル命名: `kick.wav`, `snare.wav`, `hihat_closed.wav`, `hihat_open.wav` を基本形とし、差し替え時は同名を維持する。
* 長さは 1 秒以内の短いワンショットに限定し、無音を 5ms 以内へトリム。エンベロープを揃えて自然な繋がりを確保する。
* 将来用に `audio/README.md` を用意し、サンプル差し替え手順と推奨エフェクトチェーン（EQ, コンプレッサ）を記述する。
* `audio/sample-map.json` に論理名→実ファイルのマッピングを保持し、`events.note` はこのキーを参照する。差し替え時は JSON を更新するだけで済むよう、UI 側はマッピング経由でファイルパスを解決する。

# 8. UI / 検索仕様

* タグ検索は AND 条件を基本とし、スペース区切りで複数タグを入力できる。`genre:rock` のような `キー:値` 形式も許容し、`tags` と `metadata` を横断検索する。
* 部分一致は `title` のみサポートし、`tags` は完全一致。将来の曖昧検索は別オプションで検討する。
* パターン一覧はデフォルトで `title` 昇順、BPM や追加日時でソート切り替え可。1 ページ 20 件表示、件数が多い場合はページング or 無限スクロールのいずれかを選択して実装する。
* ワイヤーフレーム案: 左ペインにフィルタ（タグ、BPM スライダー、テキスト検索）、右側にパターン詳細（譜面＋再生コントロール）。本文で言語化しておき、後で図に起こす。
* ループ/ワンクリック再生ボタン、BPM 入力、拍子表示は常に画面右上に固定し操作を簡易化する。

# 9. データバリデーション指針

* JSON 読み込み時に必須フィールド (`id`, `title`, `time_signature`, `bpm_default`, `events`, `notation`) をチェックし、欠落時は UI 上でエラー表示。
* `events` 内の `time` は 0 以上 `loop_length_beats` 未満、`velocity` は 0〜127 の整数で検証する。
* エラー時はパターンをスキップし、エラーログをコンソールへ出力。将来的に `patterns/validate.js` などの CLI を追加し、コミット前チェックを自動化できるよう spec に記載。
* JSON Schema (Draft-07) を `patterns/schema.json` として配置する想定を追記し、LLM 生成結果を `npm run validate-patterns` のようなスクリプトで検証できる状態を目指す。

# 10. 必須機能（MVP）
    { "time": 0, "note": "kick", "velocity": 100 },
    { "time": 0, "note": "hihat_closed", "velocity": 80 },
    { "time": 0.25, "note": "snare", "velocity": 100 },
    { "time": 0.5, "note": "hihat_open", "velocity": 80 }
  ],

  "notation": {
    "vexflow": {
      // VexFlow描画に必要なデータ（LLMが生成してよい）
    }
  }
}
```

### 仕様詳細

* `time` : 拍（beat）単位の相対値

  * 4/4 の 16分なら 0, 0.25, 0.5 ...
* `note` : WebAudio で再生するサンプル名
* `notation.vexflow` : VexFlow で譜面を描画するためのパラメータ

---

# 7. 必須機能（MVP）

## 7.1 パターン読み込み

* `patterns/` フォルダから JSON をロード
* 一覧表示（タイトル・タグ）

## 7.2 ドラム音再生（WebAudio）

* Kick, Snare, HH Closed/Open の WAV をロード
* JSON の event を時刻に変換して再生
* BPM 調整対応

## 7.3 譜面描画（VexFlow）

* JSON の notation 情報を解析して描画
* 一段のシンプルなドラム譜で良い

## 7.4 UI

* パターン選択
* BPM 入力
* 再生 / 停止 / ループ
* タグ検索

---

# 11. 将来拡張

当面は実装しないが、設計上考慮しておきたい項目。

* LLM をアプリ内部から呼び出して新しいパターンを生成
* MusicXML へのエクスポート
* VST / SoundFont による高音質再生
* ゴーストノートの強調表示
* シャッフル / 3連符対応
* 練習ログの記録

---

# 12. 開発方針

* あくまで **「ブラウザだけで完結する練習アプリ」** を目指す
* フロントのみで実現できる構成を優先
* 複雑な依存は避ける
* LLM はオフラインでパターン生成にのみ使い、
  アプリの中に LLM 呼び出しを組み込むのは後回し

---

# 13. Copilot Agent への指示例

この spec.md を VS Code に置いたあと、
以下を Copilot Agent Mode に指示する：

```
この spec.md の仕様に従ってプロジェクトの初期ファイルを生成してください。
index.html, app.js, style.css, audio/, patterns/, lib/ を作成し、
WebAudio と VexFlow を使って example_001.json を表示・再生する最小動作版を作ってください。
```

---

# 14. この仕様書の目的

* Copilot が誤解せずに初期実装を生成できるようにする
* プロジェクトの目的・背景・要求・技術範囲を明確化する
* パターン生成（LLM）とアプリ（JS）の責務分離をはっきりさせる
* 長期的な拡張を見据えつつも MVP を最速で構築する

