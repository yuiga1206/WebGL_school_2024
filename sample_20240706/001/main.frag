// 精度修飾子で浮動小数点の精度を指定する（省略不可）
precision mediump float;

void main() {
  // gl_FragColor が、最終的に画面に出力される色（vec4）
  // ★★ vec4 v = vec4(1.0, 1.0, 1.0, 1.0);　←　これでもOK。
  // ★★ vec4(1.0) ←　一個しか書いていない場合、全てが同じ値になる。
  gl_FragColor = vec4(1.0);
}

