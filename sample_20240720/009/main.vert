
attribute vec3 position;
attribute vec3 normal; // 頂点法線 @@@
attribute vec4 color;
uniform mat4 mvpMatrix;
varying vec4 vColor;

// ライトベクトルはひとまず定数で定義する @@@
const vec3 light = vec3(1.0, 1.0, 1.0);

void main() {
  // 単位化した法線と単位化したライトベクトルで内積を取る @@@
  float d = dot(normalize(normal), normalize(light));
  // ★★ -1.0 ~ 1.0 の範囲

  // d = d * 0.5 + 0.5; // 0.0 ~ 1.0 の範囲。 -1.0 ~ 1.0 よりも陰を弱くしている。

  // 内積の結果を頂点カラーの RGB 成分に乗算する @@@
  // ★★ 0以降（真横以降）は真っ黒になる。
  vColor = vec4(color.rgb * d, color.a);

  // ★★ 法線がちゃんと渡っているか、色にして出力する。
  // vColor = vec4(normal, 1.0);
  // xyzの情報を色（RGB）にマッピングする。
  // 上が緑、手前が青、横が赤、のように、RGBを確認する。


  // MVP 行列と頂点座標を乗算してから出力する
  gl_Position = mvpMatrix * vec4(position, 1.0);
}

