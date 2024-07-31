
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
uniform mat4 mMatrix; // モデル座標変換
uniform mat4 mvpMatrix;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec4 vColor;

void main() {
  // ワールド空間上での頂点の位置を求めてフラグメントシェーダへ
  vPosition = (mMatrix * vec4(position, 1.0)).xyz;

  // 法線と色はそのまま渡す
  vNormal = normal;
  vColor = color;

  gl_Position = mvpMatrix * vec4(position, 1.0);
}

