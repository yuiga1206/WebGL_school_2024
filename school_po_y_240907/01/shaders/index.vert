attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    //　uvの値をfragmentに渡す
    vUv = uv;
    vPosition = position;

    // three.jsではprojectionMatrixとmodelViewMatrixは別々
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}