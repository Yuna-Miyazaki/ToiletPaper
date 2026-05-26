import pandas as pd
import numpy as np

CSV_PATH = "/Users/yuna/Studying/ToiletPaperSUP/sensor_2.csv"

TIME_COL = "elapsed_ms"
VALUE_COL = "sensor_value"

# ===== 調整パラメータ =====
WINDOW = 3                 # 揺れを見る窓幅
STD_THRESHOLD = 60         # ゴタゴタ判定のしきい値
ACTIVE_FRAMES = 3           # 連続でゴタゴタなら開始
QUIET_FRAMES = 8            # 連続で静かなら終了
MERGE_GAP_MS = 1500         # 短い間隔なら同じイベントとして結合
MIN_DURATION_MS = 100       # 短すぎる検出は除外

# ===== 読み込み =====
df = pd.read_csv(CSV_PATH)
df = df.sort_values(TIME_COL).reset_index(drop=True)

# ===== 揺れ具合を計算 =====
df["rolling_std"] = (
    df[VALUE_COL]
    .rolling(window=WINDOW, min_periods=1)# 直近5フレームの標準偏差を計算
    .std()
    .fillna(0)
)

df["is_active"] = df["rolling_std"] >= STD_THRESHOLD

# ===== 複数イベント検出 =====
events = []

in_motion = False
active_count = 0
quiet_count = 0
start_idx = None

for i, active in enumerate(df["is_active"]):
    if not in_motion:
        if active:
            active_count += 1
        else:
            active_count = 0

        if active_count >= ACTIVE_FRAMES:
            start_idx = i - ACTIVE_FRAMES + 1
            in_motion = True
            quiet_count = 0

    else:
        if not active:
            quiet_count += 1
        else:
            quiet_count = 0

        if quiet_count >= QUIET_FRAMES:
            end_idx = i - QUIET_FRAMES + 1
            events.append([start_idx, end_idx])

            in_motion = False
            active_count = 0
            quiet_count = 0
            start_idx = None

# 最後までゴタゴタしていた場合
if in_motion and start_idx is not None:
    events.append([start_idx, len(df) - 1])

# ===== 近すぎるイベントを結合 =====
merged_events = []

for start, end in events:
    if not merged_events:
        merged_events.append([start, end])
    else:
        prev_start, prev_end = merged_events[-1]

        gap_ms = df.loc[start, TIME_COL] - df.loc[prev_end, TIME_COL]

        if gap_ms <= MERGE_GAP_MS:
            merged_events[-1][1] = end
        else:
            merged_events.append([start, end])

# ===== 短すぎるイベントを除外 =====
final_events = []

for start, end in merged_events:
    duration_ms = df.loc[end, TIME_COL] - df.loc[start, TIME_COL]

    if duration_ms >= MIN_DURATION_MS:
        final_events.append([start, end])

# ===== 結果をDataFrameに追加 =====
df["event"] = ""

for n, (start, end) in enumerate(final_events, start=1):
    df.loc[start, "event"] = f"start_{n}"
    df.loc[end, "event"] = f"end_{n}"

# ===== 結果表示 =====
print("=== 検出結果 ===")
print(f"検出イベント数: {len(final_events)}")

for n, (start, end) in enumerate(final_events, start=1):
    start_time = df.loc[start, TIME_COL]
    end_time = df.loc[end, TIME_COL]
    duration = end_time - start_time

    print(f"\n--- event {n} ---")
    print(f"開始フレーム: index={start}, time={start_time} ms, value={df.loc[start, VALUE_COL]}")
    print(f"終了フレーム: index={end}, time={end_time} ms, value={df.loc[end, VALUE_COL]}")
    print(f"継続時間: {duration} ms")

# ===== 保存 =====
OUTPUT_PATH = "edge_detected_result.csv"
df.to_csv(OUTPUT_PATH, index=False)

print(f"\n保存しました: {OUTPUT_PATH}")
