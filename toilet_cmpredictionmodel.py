import pandas as pd
from sklearn.linear_model import LinearRegression

# ===== 教師データ =====
# (startIndex, endIndex, used_cm)

data = [
    (115, 140, 88.8),
    (187, 216, 104.8),
    (267, 294, 116.8),
    (344, 358, 45.6),
    (418, 438, 106.4),
    (494, 526, 160.8),
    (593, 612, 76.8),
    (687, 722, 177.6),
    (809, 827, 71.2),
    (939, 955, 75.2),
]

# ===== DataFrame化 =====
df = pd.DataFrame(data, columns=["start", "end", "used_cm"])

# frame数を計算
df["frame_count"] = df["end"] - df["start"]

print(df)

# ===== 学習 =====
X = df[["frame_count"]]   # 入力
y = df["used_cm"]         # 正解

model = LinearRegression()
model.fit(X, y)

# ===== a,b を取得 =====
a = model.coef_[0]
b = model.intercept_

print("\n=== 結果 ===")
print(f"a = {a}")
print(f"b = {b}")

print("\n=== 回帰式 ===")
print(f"used_cm = {a:.3f} * frame_count + {b:.3f}")

# ===== 予測 =====
df["predicted_cm"] = model.predict(X)

# 誤差
df["error"] = df["predicted_cm"] - df["used_cm"]

print("\n=== 予測結果 ===")
print(df[["frame_count", "used_cm", "predicted_cm", "error"]])

import matplotlib.pyplot as plt
plt.scatter(df["frame_count"], df["used_cm"])
plt.plot(df["frame_count"], df["predicted_cm"])
plt.show()