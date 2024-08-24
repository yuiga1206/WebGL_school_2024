
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
uniform mat4 mMatrix;
uniform mat4 mvpMatrix;
uniform mat4 normalMatrix;
uniform vec3 eyePosition;
varying vec4 vColor;

// ライトベクトルはひとまず定数で定義する
const vec3 light = vec3(1.0, 1.0, 1.0);

void main() {
  // 法線をまず行列で変換する
  vec3 n = (normalMatrix * vec4(normal, 0.0)).xyz;
  // 変換した法線とライトベクトルで内積を取る
  float d = dot(normalize(n), normalize(light));
  // 0.0 ~ 0.5 に変換（ハイライトを見やすくするため）
  d = d * 0.25 + 0.25;

  // 視線ベクトル
  vec3 p = (mMatrix * vec4(position, 1.0)).xyz;
  vec3 e = normalize(p - eyePosition);
  // 視線ベクトルの反射ベクトル
  e = reflect(e, n);
  float s = clamp(dot(e, normalize(light)), 0.0, 1.0);
  s = pow(s, 10.0);

  // 内積の結果を頂点カラーの RGB 成分に乗算する
  vColor = vec4(color.rgb * d + s, color.a);

  // MVP 行列と頂点座標を乗算してから出力する
  gl_Position = mvpMatrix * vec4(position, 1.0);
}

