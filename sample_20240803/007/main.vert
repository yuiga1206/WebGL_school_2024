
attribute vec3 position;
attribute vec4 color;
uniform mat4 mvpMatrix;
varying vec4 vColor;

void main() {
  vColor = color;

  // MVP 行列と頂点座標を乗算してから出力する
  gl_Position = mvpMatrix * vec4(position, 1.0);
}

