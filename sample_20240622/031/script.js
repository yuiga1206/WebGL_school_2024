
// = 031 ======================================================================
// WebGL では、画面に直接描画結果を出すだけでなく、内部的に描画を行い、その結果
// をメモリ上に保持しておく機能があります。
// 表面上スクリーンに現れない描画であることから、このような内部的な描画処理のこ
// とをオフスクリーンレンダリングと呼びます。
// 一見、画面に直接描画せずに内部的に描画結果を保持できても、それの何が便利なの
// か想像するのが難しいかもしれません。しかし現代の CG においてオフスクリーンレ
// ンダリングは極めて重要な役割を担っています。１つ上の表現を目指すなら、避けて
// は通れないテクニックと言えます。
// たとえば、3D シーン内にテレビやディスプレイがあるような場面で、画面の部分に別
// の 3D シーンを投影したり、レーシングゲームでミラーに映るシーンをレンダリング
// したり、あるいは、ガラスや水面に映り込む風景を作ったりするのにもオフスクリー
// ンレンダリングが利用されています。ちなみに、ポストプロセス処理（ポストエフェ
// クト）も、オフスクリーンレンダリングなしには実現できません。
// three.js でも当然オフスクリーンレンダリングを行うことができ、レンダラーに対し
// て「レンダーターゲット」と呼ばれるオブジェクトを割り当てることでこれを実現し
// ます。
// ============================================================================

// 必要なモジュールを読み込み
import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  await app.load();
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
    intensity: 0.1,
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xffffff,
  };
  /**
   * レンダーターゲットの大きさ @@@
   */
  static RENDER_TARGET_SIZE = 1024;

  wrapper;          // canvas の親要素
  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  gltf;             // 読み込んだ glTF 格納用

  offscreenScene;   // オフスクリーン用のシーン @@@
  offscreenCamera;  // オフスクリーン用のカメラ @@@
  plane;            // 板ポリゴン @@@
  renderTarget;     // オフスクリーン用のレンダーターゲット @@@
  blackColor;       // 背景色出し分けのため @@@
  whiteColor;       // 背景色出し分けのため @@@

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

    // オフスクリーン用のシーン @@@
    // 以下、各種オブジェクトやライトはオフスクリーン用のシーンに add しておく
    this.offscreenScene = new THREE.Scene();

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
    this.offscreenScene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.offscreenScene.add(this.ambientLight);

    // シーンに glTF を追加
    this.offscreenScene.add(this.gltf.scene);

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.offscreenScene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // レンダーターゲットをアスペクト比 1.0 の正方形で生成する @@@
    this.renderTarget = new THREE.WebGLRenderTarget(ThreeApp.RENDER_TARGET_SIZE, ThreeApp.RENDER_TARGET_SIZE);

    // オフスクリーン用のカメラは、この時点でのカメラの状態を（使いまわして手間軽減のため）クローンしておく @@@
    this.offscreenCamera = this.camera.clone();
    // ただし、最終シーンがブラウザのクライアント領域のサイズなのに対し……
    // レンダーターゲットは正方形なので、アスペクト比は 1.0 に設定を上書きしておく
    this.offscreenCamera.aspect = 1.0;
    this.offscreenCamera.updateProjectionMatrix();

    // レンダリング結果を可視化するのに、板ポリゴンを使う @@@
    const planeGeometry = new THREE.PlaneGeometry(5.0, 5.0);
    const planeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);

    // 板ポリゴンのマテリアルには、レンダーターゲットに描き込まれた結果を投影したいので……
    // マテリアルの map プロパティにレンダーターゲットのテクスチャを割り当てておく @@@
    planeMaterial.map = this.renderTarget.texture;

    // 板ポリゴンをシーンに追加
    this.scene.add(this.plane);

    // 背景色を出し分けるため、あらかじめ Color オブジェクトを作っておく @@@
    this.blackColor = new THREE.Color(0x000000);
    this.whiteColor = new THREE.Color(0xffffff);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    return new Promise((resolve) => {
      // 読み込むファイルのパス
      const gltfPath = './Duck.glb';
      const loader = new GLTFLoader();
      loader.load(gltfPath, (gltf) => {
        this.gltf = gltf;
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

    // オフスクリーンレンダリングがリアルタイムであることをわかりやすくするため……
    // Duck には絶えず動いておいてもらう @@@
    this.gltf.scene.rotation.y += 0.01;

    // まず最初に、オフスクリーンレンダリングを行う @@@
    this.renderer.setRenderTarget(this.renderTarget);
    // オフスクリーンレンダリングは常に固定サイズ
    this.renderer.setSize(ThreeApp.RENDER_TARGET_SIZE, ThreeApp.RENDER_TARGET_SIZE);
    // わかりやすくするために、背景を黒にしておく
    this.renderer.setClearColor(this.blackColor, 1.0);
    // オフスクリーン用のシーン（Duck が含まれるほう）を描画する
    this.renderer.render(this.offscreenScene, this.offscreenCamera);

    // 次に最終的な画面の出力用のシーンをレンダリングするため null を指定しもとに戻す @@@
    this.renderer.setRenderTarget(null);
    // 最終的な出力はウィンドウサイズ
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // わかりやすくするために、背景を白にしておく
    this.renderer.setClearColor(this.whiteColor, 1.0);
    // 板ポリゴンが１枚置かれているだけのシーンを描画する
    this.renderer.render(this.scene, this.camera);
  }
}
