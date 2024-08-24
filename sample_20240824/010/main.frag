precision mediump float;

varying vec4 vColor;

void main() {

  // 第6回課題：ここで陰影計算してみる
  // ???
  // 頂点シェーダで陰影：頂点が計算した陰影を色として補完している。
  // フラグメントシェーダで陰影：ピクセルの一個一個で計算するので、よりキレイな陰影になる。

  gl_FragColor = vColor;
}

