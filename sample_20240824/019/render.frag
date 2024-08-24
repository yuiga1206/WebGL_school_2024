precision mediump float;

uniform sampler2D textureUnit;
uniform bool useTypeOne;
uniform float time;
uniform float alpha;
varying vec2 vTexCoord;

const float INVERSE3 = 1.0 / 3.0;

// 乱数生成（その１）
// 疑似乱数とは、コンピューターは計算機なので、本当の意味での自然界のランダムは再現できない（真正乱数）
float rnd(vec2 p){
  // sin を使って、その小数点以下の値だけを取り出して駅手、一見ランダム風に見えてるだけ
  // sin を使ってるだけのシンプルなアルゴリズムなので、品質は高くないため、模様が見えるようなパターン化
  // 正しくないし、品質も良くないけど、速い！
  return fract(sin(dot(p ,vec2(12.9898,78.233))) * 43758.5453);
}

// 乱数生成器（その２）
// 精度が上がることがある（絶対ではない）。
// 整数の桁数を減らすことにより、小数点以下に使うビット数を増やしている。
float rnd2(vec2 n){
  float a  = 0.129898;
  float b  = 0.78233;
  float c  = 437.585453;
  float dt = dot(n ,vec2(a, b));
  float sn = mod(dt, 3.14);
  return fract(sin(sn) * c);
}

void main() {
  // テクスチャの色
  vec4 samplerColor = texture2D(textureUnit, vTexCoord);

  // グレイスケール化
  float gray = dot(vec3(1.0), samplerColor.rgb) * INVERSE3;

  // グレイスケール化した色を補正する
  gray = gray * (1.0 - alpha);

  // ホワイトノイズを取得する
  float noise = 0.0;
  if (useTypeOne == true) {
    noise = rnd(gl_FragCoord.xy + time);
  } else {
    noise = rnd2(gl_FragCoord.xy + time);
  }

  // ノイズの明るさを補正する
  noise *= alpha;

  // 最終出力カラーを合成する
  gl_FragColor = vec4(vec3(gray + noise), 1.0);
}


