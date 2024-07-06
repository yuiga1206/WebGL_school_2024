precision mediump float;

// 経過時間を uniform 変数（の浮動小数点）として受け取る
uniform float time;

varying vec4 vColor;

void main() {
  // 時間の経過からサイン波を作り、絶対値で点滅させるようにする @@@
  // ★★ GLSLのビルトイン関数sin　← JSのsinとは違う。
  // ★★ sinの値は 1 〜 -1 （0 → 1 → 0 → -1 → 0 → …）の範囲なので……
  // ★★ -1（負の値）を無視したい。
  // ★★ abs === absolute 絶対値（符号を無視した値）
  vec3 rgb = vColor.rgb * abs(sin(time));
  // フラグメントの色
  gl_FragColor = vec4(rgb, vColor.a);
}

