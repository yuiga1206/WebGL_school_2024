precision mediump float;

uniform sampler2D textureUnit;
uniform float lightness;
varying vec2 vTexCoord;

void main() {
  // オフスクリーンレンダリングの結果をまず取り出す
  vec4 samplerColor = texture2D(textureUnit, vTexCoord);

  // RGB の各チャンネルの単純な平均 @@@
  // ※ここでは内積を使っていますが、そうしなければ実現できない処理というわけではありません
  float gray = dot(vec3(1.0), samplerColor.rgb) / 3.0;

  // ヴィネット @@@
  vec2 centerCoord = vTexCoord * 2.0 - 1.0;
  float vignette = 1.0 - length(centerCoord) * 0.5;

  // 念のため 0.0 ～ 1.0 にクランプ
  gray = clamp(gray * vignette + lightness, 0.0, 1.0);

  // すべての係数を合成して出力
  gl_FragColor = vec4(vec3(gray), samplerColor.a);
}

