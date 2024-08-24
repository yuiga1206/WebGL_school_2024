precision mediump float;

uniform sampler2D textureUnit;
uniform float lightness;
varying vec2 vTexCoord;

void main() {
  // オフスクリーンレンダリングの結果をまず取り出す
  vec4 samplerColor = texture2D(textureUnit, vTexCoord);

  // RGB の各チャンネルの単純な平均 @@@
  // ※ここでは内積（dot）を使っていますが、そうしなければ実現できない処理というわけではありません
  // グレースケール
  // dot == v ・ w == v.x * w.x + v.y * w.y
  // dot (1.0 と RGB) = r * 1 + g * 1 + b * 1 = r + g + b
  // = (r + g + b / 3)
  // RGB の平均値を求めてるだけ
  // ベクトルの内積とはどんな計算だったか、思い出してほしいので内積を使っているだけ。
  float gray = dot(vec3(1.0), samplerColor.rgb) / 3.0;
  // float gray = (samplerColor.r + samplerColor.g + samplerColor.b) / 3.0;  でも良い。

  // ヴィネット @@@
  // 原点左下：0~1 を -1~1 にしている　＝　ど真ん中に原点を持って行く。
  vec2 centerCoord = vTexCoord * 2.0 - 1.0; 
  // 原点からの距離を測っている。
  // 真ん中から遠いほど、length(centerCoord) は大きい数値になる。
  float vignette = 1.0 - length(centerCoord) * 0.5; // 遠ければ遠いほど vignette の中身は小さくなる。 == 暗い色で出る

  // 念のため 0.0 ～ 1.0 にクランプ
  gray = clamp(gray * vignette + lightness, 0.0, 1.0);

  // すべての係数を合成して出力
  gl_FragColor = vec4(vec3(gray), samplerColor.a);


  // gl_FragColor = vec4(vTexCoord, 0.0, 1.0);
  // のように、色でデバッグしてみる
  //   ※ 動画1:55くらいのところで、色デバッグの話
  // 　　┗　色として可視化するならこういうこと。
}

