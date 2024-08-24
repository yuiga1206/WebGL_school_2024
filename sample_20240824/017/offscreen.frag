precision mediump float;

uniform vec3 lightVector;
varying vec3 vNormal;

void main() {
  vec3 light = normalize(lightVector);
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(light, normal), 0.0) * 0.5 + 0.5;
  gl_FragColor = vec4(vec3(diffuse), 1.0);
}

