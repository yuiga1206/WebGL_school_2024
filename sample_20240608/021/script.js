
// = 021 ======================================================================
// 地球と月に加え、第三の登場人物として人工衛星を追加して、ベクトルを用いた処理
// についてもう少し踏み込んで見ていきます。
// このサンプルでは、月の位置を目がけて人工衛星が常に移動し続けるようになってい
// ます。つまり「追尾」ですね。
// 追尾と言ってしまうと、ゲームなどの分野でしか使えないもののように感じるかもし
// れませんが、たとえばウェブ上でも、カーソルを追いかけるオブジェクトを作ってみ
// たり、あるいは狙った方向にオブジェクトを移動させたりと、応用範囲は多岐にわた
// ります。
// ベクトルを使った「任意の方向への移動」の原理をしっかり把握しましょう。
// ============================================================================

// 必要なモジュールを読み込み
import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  await app.load();
  app.init();
  app.render();
}, false);

class ThreeApp {
  /**
   * 月に掛けるスケール
   */
  static MOON_SCALE = 0.27;
  /**
   * 月と地球の間の距離
   */
  static MOON_DISTANCE = 3.0;
  /**
   * 人工衛星の移動速度 @@@
   */
  static SATELLITE_SPEED = 0.05;
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
    clearColor: 0xffffff,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 1.0,
    position: new THREE.Vector3(1.0, 1.0, 1.0),
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 0.3,
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xffffff,
  };
  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0xffffff,
    near: 10.0,
    far: 20.0,
  };

  wrapper;           // canvas の親要素
  renderer;          // レンダラ
  scene;             // シーン
  camera;            // カメラ
  directionalLight;  // 平行光源（ディレクショナルライト）
  ambientLight;      // 環境光（アンビエントライト）
  controls;          // オービットコントロール
  axesHelper;        // 軸ヘルパー
  isDown;            // キーの押下状態用フラグ
  clock;             // 時間管理用
  sphereGeometry;    // ジオメトリ
  earth;             // 地球
  earthMaterial;     // 地球用マテリアル
  earthTexture;      // 地球用テクスチャ
  moon;              // 月
  moonMaterial;      // 月用マテリアル
  moonTexture;       // 月用テクスチャ
  satellite;         // 人工衛星 @@@
  satelliteMaterial; // 人工衛星用マテリアル @@@

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // 初期化時に canvas を append できるようにプロパティに保持
    this.wrapper = wrapper;

    // 再帰呼び出しのための this 固定
    this.render = this.render.bind(this);

    // キーの押下や離す操作を検出できるようにする
    window.addEventListener('keydown', (keyEvent) => {
      switch (keyEvent.key) {
        case ' ':
          this.isDown = true;
          break;
        default:
      }
    }, false);
    window.addEventListener('keyup', (keyEvent) => {
      this.isDown = false;
    }, false);

    // マウスカーソルの動きを検出できるようにする
    window.addEventListener('pointermove', (pointerEvent) => {
      // ポインター（マウスカーソル）のクライアント領域上の座標
      const pointerX = pointerEvent.clientX;
      const pointerY = pointerEvent.clientY;
      // 3D のワールド空間に合わせてスケールを揃える
      const scaleX = pointerX / window.innerWidth * 2.0 - 1.0;
      const scaleY = pointerY / window.innerHeight * 2.0 - 1.0;
      // ベクトルを単位化する
      const vector = new THREE.Vector2(
        scaleX,
        scaleY,
      );
      vector.normalize();
      // スケールを揃えた値を月の座標に割り当てる
      this.moon.position.set(
        vector.x * ThreeApp.MOON_DISTANCE,
        0.0,
        vector.y * ThreeApp.MOON_DISTANCE,
      );
    }, false);

    // リサイズイベント
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    return new Promise((resolve) => {
      const earthPath = './earth.jpg';
      const moonPath = './moon.jpg';
      const loader = new THREE.TextureLoader();
      loader.load(earthPath, (earthTexture) => {
        // 地球用
        this.earthTexture = earthTexture;
        loader.load(moonPath, (moonTexture) => {
          // 月用
          this.moonTexture = moonTexture;
          resolve();
        });
      });
    });
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
    this.scene.fog = new THREE.Fog(
      ThreeApp.FOG_PARAM.color,
      ThreeApp.FOG_PARAM.near,
      ThreeApp.FOG_PARAM.far
    );

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far,
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // 球体のジオメトリを生成
    this.sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);

    // 地球のマテリアルとメッシュ
    this.earthMaterial = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);
    this.earthMaterial.map = this.earthTexture;
    this.earth = new THREE.Mesh(this.sphereGeometry, this.earthMaterial);
    this.scene.add(this.earth);

    // 月のマテリアルとメッシュ
    this.moonMaterial = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);
    this.moonMaterial.map = this.moonTexture;
    this.moon = new THREE.Mesh(this.sphereGeometry, this.moonMaterial);
    this.scene.add(this.moon);
    // 月はやや小さくして、さらに位置も動かす
    this.moon.scale.setScalar(ThreeApp.MOON_SCALE);
    this.moon.position.set(ThreeApp.MOON_DISTANCE, 0.0, 0.0);

    // 人工衛星のマテリアルとメッシュ @@@
    this.satelliteMaterial = new THREE.MeshPhongMaterial({color: 0xff00dd});
    this.satellite = new THREE.Mesh(this.sphereGeometry, this.satelliteMaterial);
    this.scene.add(this.satellite);
    this.satellite.scale.setScalar(0.1); // より小さく
    this.satellite.position.set(0.0, 0.0, ThreeApp.MOON_DISTANCE); // +Z の方向に初期位置を設定

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // キーの押下状態を保持するフラグ
    this.isDown = false;

    // Clock オブジェクトの生成
    this.clock = new THREE.Clock();
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループ
    requestAnimationFrame(this.render);

    // コントロールを更新
    this.controls.update();

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      this.earth.rotation.y += 0.05;
      this.moon.rotation.y += 0.05;
    }

    // 人工衛星は月を自動追尾する @@@
    // (終点 - 始点) という計算を行うことで、２点間を結ぶベクトルを定義
    const subVector = new THREE.Vector3().subVectors(this.moon.position, this.satellite.position);
    // 長さに依存せず、向きだけを考えたい場合はベクトルを単位化する
    subVector.normalize();
    // 現在の人工衛星の座標に、向きベクトルを小さくスケールして加算する
    this.satellite.position.add(subVector.multiplyScalar(ThreeApp.SATELLITE_SPEED));

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
