
// = 026 ======================================================================
// 3DCG にはポイントスプライトというテクニックがあります。
// これはポリゴンではなく点で頂点を描画する際、その点の１つ１つにテクスチャを貼
// り付けたもののことを言い、頂点を節約しながらテクスチャを用いた表現を行うこと
// ができます。
// ポイントスプライトはどこまで行っても結局は点であるため、常にカメラに対して正
// 対したように描かれます。このような振る舞いは CG 用語ではビルボードなどと言わ
// れることがありますが、ポリゴンをビルボードとして描画することに比べると、ポイ
// ントスプライトはより手軽にビルボードを実現できる手段だと言えます。
// ※ポリゴンでビルボードするには姿勢制御を実装する必要があるため
// ============================================================================

// 必要なモジュールを読み込み
import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  await app.load(); // ★★ 先に非同期処理する。
  app.init();
  app.render();
}, false);

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 50.0,
    position: new THREE.Vector3(0.0, 2.0, 10.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x000000,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * マテリアル定義のための定数（パーティクル用）
   */
  static MATERIAL_PARAM = {
    color: 0xffcc00,      // パーティクルの色
    size: 0.5,            // 基準となるサイズ
    sizeAttenuation: true // 遠近感を出すかどうかの真偽値
  };

  wrapper;    // canvas の親要素
  renderer;   // レンダラ
  scene;      // シーン
  camera;     // カメラ
  geometry;   // ジオメトリ
  material;   // マテリアル
  points;     // パーティクルの実態（点群のメッシュに相当）
  controls;   // オービットコントロール
  axesHelper; // 軸ヘルパー
  texture;    // テクスチャ

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // 初期化時に canvas を append できるようにプロパティに保持
    this.wrapper = wrapper;

    // this のバインド
    this.render = this.render.bind(this);

    // ウィンドウのリサイズを検出できるようにする
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * 初期化処理
   */
  init() {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    this.wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far,
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // パーティクル用のマテリアル
    this.material = new THREE.PointsMaterial(ThreeApp.MATERIAL_PARAM);
    // 点用のマテリアルに対してテクスチャを設定すると簡易的なビルボードになる @@@
    // ※点は点でしかないので面とは異なり傾いたりしないため、ビルボードとみなせる
    this.material.map = this.texture;

    // パーティクルの定義
    this.geometry = new THREE.BufferGeometry();
    const COUNT = 200;
    const WIDTH = 10.0;
    const vertices = [];
    for (let i = 0; i <= COUNT; ++i) {
      // 範囲内にランダムに頂点を配置 @@@
      vertices.push(
        // ★★ Math.random() 0以上1未満を返す
        // ★★ 0~1だったものが、-5~5になっている。
        Math.random() * WIDTH - (WIDTH * 0.5),
        Math.random() * WIDTH - (WIDTH * 0.5),
        Math.random() * WIDTH - (WIDTH * 0.5),
      );
    }
    const stride = 3;
    const attribute = new THREE.BufferAttribute(new Float32Array(vertices), stride);
    this.geometry.setAttribute('position', attribute);

    // パーティクルを格納したジオメトリとマテリアルからポイントオブジェクトを生成
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    return new Promise((resolve) => {
      const imagePath = './star.png';
      const loader = new THREE.TextureLoader();
      loader.load(imagePath, (texture) => {
        this.texture = texture;
        resolve();
      });
    });
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループ
    requestAnimationFrame(this.render);

    // コントロールを更新
    this.controls.update();

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
