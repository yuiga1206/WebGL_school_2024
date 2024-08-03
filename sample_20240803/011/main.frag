precision mediump float;

uniform sampler2D textureUnit; // テクスチャユニット番号を受け取る窓口 @@@

varying vec4 vColor; // ★★ vec4(1.0)
varying vec2 vTexCoord; // テクスチャ座標 @@@

void main() {
  // テクスチャから、テクスチャ座標の位置の色を取り出す @@@
  // ※フラグメントシェーダはピクセルの単位で動作していることを念頭に
  vec4 textureColor = texture2D(textureUnit, vTexCoord);

  gl_FragColor = vColor * textureColor; // ★★ vec4(1.0)との乗算なので、textureColor は変化なし。
  // gl_FragColor = vColor * (vec4(1.0) - vec4(textureColor.rgb, 0.0)); // ★★ r（赤）の色が無くなる。


  // gl_FragColor = textureColor; // ★★ そのままの色を出すなら、これでもOK。
  // ★★ ↑ わざわざ vColor を掛けるのは、頂点自体が色を持ってる場合、頂点の色も反映しないといけないので、vColor を掛けている。
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * textureColor; // ★★ 頂点が赤色だった場合。
}

