precision mediump float;

varying vec4 vColor;

void main() {
  float gamma = 1.0 / 2.2;
  vec3 rgb = pow(vColor.rgb, vec3(gamma));

  gl_FragColor = vec4(rgb, vColor.a);
}

