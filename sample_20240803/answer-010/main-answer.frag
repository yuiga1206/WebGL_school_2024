precision mediump float;

uniform vec3 eyePosition; // 視点位置
uniform mat4 normalMatrix; // 法線変換行列
varying vec3 vPosition;
varying vec3 vNormal;
varying vec4 vColor;

// ライトベクトルはひとまず定数で定義する
const vec3 light = vec3(1.0, 1.0, 1.0);

void main() {
  // 拡散光
  vec3 n = normalize((normalMatrix * vec4(normalize(vNormal), 0.0)).xyz);
  float d = dot(n, normalize(light));
  // 0.0 ~ 0.5 に変換（ハイライトを見やすくするため）
  d = d * 0.25 + 0.25;

  // 視線ベクトル
  vec3 e = normalize(vPosition - eyePosition);
  // 視線ベクトルの反射ベクトル
  e = reflect(e, n);
  // 反射光
  float s = clamp(dot(e, normalize(light)), 0.0, 1.0);
  s = pow(s, 10.0);

  // 最終出力
  vec4 color = vec4(vColor.rgb * d + s, vColor.a);
  float gamma = 1.0 / 2.2;
  vec3 rgb = pow(color.rgb, vec3(gamma));
  gl_FragColor = vec4(rgb, color.a);
}

