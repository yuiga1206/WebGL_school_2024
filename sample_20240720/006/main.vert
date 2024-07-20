
attribute vec3 position;
attribute vec4 color;
uniform mat4 mvpMatrix;
varying vec4 vColor;

void main() {
  vColor = color;

  // MVP 行列と頂点座標を乗算してから出力する @@@
  // ★★ モデル・ビュー・プロジェクション変換のすべてが一度に適応される。
  gl_Position = mvpMatrix * vec4(position, 1.0);

  // ↓のように、シェーダの中で行列の中身を動的に書き換えることは可能。
  // が、GPUの計算が増えるので、理由がなければやらない。
  // mat4 m = mvpMatrix * hogeMatrix
  // gl_Position = m * vec4(position, 1.0);
}

