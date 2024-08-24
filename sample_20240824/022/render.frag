precision mediump float;

uniform sampler2D textureUnit; // テクスチャユニット
uniform vec2 resolution;       // 画面の解像度（canvasの解像度、ビューポートの解像度）
uniform bool horizontal;       // 縦横のどちらにぼかすかのフラグ（true == 横）
uniform float weight[20];      // ガウシアンブラーに使うガウス係数 // 長さが20の配列

varying vec2 vTexCoord;

void main() {
  vec2 fSize = 1.0 / resolution; // フラグメントあたりの大きさ
  // resolution = vec2(100, 100) = 1 / vec2 = vec2(0.01, 0,01)
  vec2 fc = gl_FragCoord.st;     // ピクセルサイズの座標
  vec2 texCoord = vec2(0.0);     // テクスチャ座標格納用

  // 中心位置（本来の位置）の色
  vec4 blurColor = vec4(texture2D(textureUnit, fc * fSize).rgb * weight[0], 1.0);
  // フラグの状態によってどの方向にシフトするのかを変化させる
  if (horizontal) {
    // 20 回の繰り返し処理でぼかしていく
    // ※ 繰り返しの回数は JavaScript 側の gaussWeight の引数と連動しています
    // ※ GLSL 側では繰り返し回数を定数で指定する必要があるので注意！
    // ※ 誤りの例： `for (int 1; i < ここに変数; ++i) {}` ← これはエラーになる
    for (int i = 1; i < 20; ++i) {
      texCoord = (fc + vec2(float(i), 0.0)) * fSize;  // 左にシフト
      blurColor += vec4(texture2D(textureUnit, texCoord).rgb * weight[i], 1.0);
      texCoord = (fc + vec2(-float(i), 0.0)) * fSize; // 右にシフト
      blurColor += vec4(texture2D(textureUnit, texCoord).rgb * weight[i], 1.0);
    }
  } else {
    for (int i = 1; i < 20; ++i) {
      texCoord = (fc + vec2(0.0, float(i))) * fSize;  // 上にシフト
      blurColor += vec4(texture2D(textureUnit, texCoord).rgb * weight[i], 1.0);
      texCoord = (fc + vec2(0.0, -float(i))) * fSize; // 下にシフト
      blurColor += vec4(texture2D(textureUnit, texCoord).rgb * weight[i], 1.0);
    }
  }
  // 最終出力
  gl_FragColor = blurColor;
}


