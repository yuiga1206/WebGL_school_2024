
import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  await app.init();
  app.render();
}, false);

class ThreeApp {
  // インスタンスの数
  static INSTANCE_COUNT = 100;
  // ランダムに散らばる範囲のスケール
  static RANDOM_SCALE = 10.0;

  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 500.0,
    position: new THREE.Vector3(0.0, 2.0, 10.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  static RENDERER_PARAM = {
    clearColor: 0x111111,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  static load(path) {
    return new Promise(async (resolve) => {
      const response = await fetch(path);
      const text = await response.text();
      resolve(text);
    });
  }

  wrapper;       // canvas の親要素
  renderer;      // レンダラ
  scene;         // シーン
  camera;        // カメラ
  geometry;      // ジオメトリ
  material;      // マテリアル
  instancedMesh; // インスタンシング用メッシュ
  controls;      // オービットコントロール
  axesHelper;    // 軸ヘルパー
  clock;         // 時間管理 @@@

  constructor(wrapper) {
    this.wrapper = wrapper;

    this.render = this.render.bind(this);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  async init() {
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    this.wrapper.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far,
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // 自前の頂点シェーダと、対になるフラグメントシェーダのソースコードを準備 @@@
    const vs = await ThreeApp.load('./instanced.vert'); // ★★ 頂点シェーダ
    const fs = THREE.ShaderLib.basic.fragmentShader; // ★★ フラグメントシェーダは完全に流用
    // ★★ この VS と FS は、チャンクが変換される前の、独自構文のソースコード

    // 元にしたマテリアルの既定の uniform 変数の情報を取得 @@@
    const uniforms = THREE.ShaderLib.basic.uniforms;
    // 独自のシェーダを利用できるマテリアルを生成 @@@
    // ★★ three.js のエコシステムにある程度依存している
    this.material = new THREE.ShaderMaterial({
      // ★★ Object.assign(元になるやつ, くっつけるやつ)
      uniforms: Object.assign({}, uniforms, {
        // ★★ 自分が使いたいオリジナルの uniform 変数
        time: {value: 0.0},
      }),
      vertexShader: vs,
      fragmentShader: fs,
      side: THREE.DoubleSide,
    });

    this.geometry = new THREE.InstancedBufferGeometry();
    const vertices = [
       0.0,   0.0,  0.0,
       1.0,   0.0, -1.0, // 羽根の右前先端
       0.7,   0.0,  1.0, // 羽根の右後ろ先端
      -1.0,   0.0, -1.0, // 羽根の左前先端
      -0.7,   0.0,  1.0, // 羽根の左後ろ先端
       0.1,   0.1, -0.4, // 触角の右先端
       0.05, -0.1, -0.2, // 触角の右中間
      -0.1,   0.1, -0.4, // 触角の右先端
      -0.05, -0.1, -0.2, // 触角の右中間
    ];
    const stride = 3;
    const indices = [
      0, 2, 1, // 羽根右
      0, 3, 4, // 羽根左
      0, 6, 5, // 触角右
      0, 7, 8, // 触角左
    ];
    const attribute = new THREE.BufferAttribute(new Float32Array(vertices), stride);
    this.geometry.setAttribute('position', attribute);
    this.geometry.setIndex(indices);

    this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, ThreeApp.INSTANCE_COUNT);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < ThreeApp.INSTANCE_COUNT; ++i) {
      dummy.position.set(
        (Math.random() * 2.0 - 1.0) * ThreeApp.RANDOM_SCALE,
        (Math.random() * 2.0 - 1.0) * ThreeApp.RANDOM_SCALE,
        (Math.random() * 2.0 - 1.0) * ThreeApp.RANDOM_SCALE,
      );
      dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, dummy.matrix);
    }

    this.scene.add(this.instancedMesh);

    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.clock = new THREE.Clock();
  }

  render() {
    requestAnimationFrame(this.render);
    // 経過時間を uniform 変数に反映する @@@
    this.material.uniforms.time.value = this.clock.getElapsedTime();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
