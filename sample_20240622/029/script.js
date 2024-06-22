
// = 029 ======================================================================
// glTF にはアニメーションの情報を含めることができる仕様があり、three.js はこれ
// に対応しています。
// three.js にはミキサーと呼ばれるアニメーションの再生を制御する仕組みがあるので、
// これを利用して glTF モデルをアニメーションさせてみましょう。
// 複数のアニメーションを内蔵する glTF の場合は、それぞれのモーションごとのウェ
// イト（重み）を調整することで、それらを 50% ずつブレンドするといった複雑な制御
// を行うこともできます。
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
    far: 500.0,
    position: new THREE.Vector3(0.0, 50.0, 200.0),
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

  wrapper;          // canvas の親要素
  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  gltf;             // 読み込んだ glTF 格納用
  mixer;            // アニメーションミキサー @@@
  actions;          // アニメーションのアクション @@@
  clock;            // アニメーション用のクロック @@@

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

    // シーンに glTF を追加
    this.scene.add(this.gltf.scene);

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // アニメーション時間管理のための Clock オブジェクトを生成しておく @@@
    this.clock = new THREE.Clock();

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    return new Promise((resolve) => {
      // 読み込むファイルのパス
      const gltfPath = './Fox.glb';
      const loader = new GLTFLoader();
      loader.load(gltfPath, (gltf) => {
        // glTF のロードが終わったらアニメーション関連の初期化を同時に行う @@@
        this.gltf = gltf;

        // ★★ アニメーションの初期化処理
        // ミキサーを生成する（scene プロパティを渡す点に注意）
        this.mixer = new THREE.AnimationMixer(this.gltf.scene);
        // アニメーション情報を取り出す（配列で入っているのでループで順番に処理）
        const animations = this.gltf.animations;
        // 取り出したアニメーション情報を順番にミキサーに通してアクション化する
        this.actions = [];
        for(let i = 0; i < animations.length; ++i){
          // アクションを生成
          // const action = this.mixer.clipAction(animations[i]);
          // this.actions.push(action);
          // ★★ ↑2行にしてもOK
          this.actions.push(this.mixer.clipAction(animations[i]));
          // ループ方式を設定する
          this.actions[i].setLoop(THREE.LoopRepeat);
          // 再生状態にしつつ、ウェイトをいったん 0.0 にする
          this.actions[i].play();
          this.actions[i].weight = 0.0;
        }

        // 最初のアクションのウェイトだけ 1.0 にして目に見えるようにしておく
        this.actions[0].weight = 1.0;
        // ★★ this.actions には3つのアニメーションが入っている。
        // this.actions[0].weight = 0.5;
        // this.actions[1].weight = 0.5;

        // - アクションのウェイト ---------------------------------------------
        // three.js の AnimationAction では上記のように weight という概念があり
        // アニメーションに対して重み付けができます。
        // このウェイトは、再生されるアニメーションに対してアクションをどの程度
        // 反映させるかの指標で、0.0 ～ 1.0 の範囲で指定します。これを上手に制御
        // してやることで、スムーズに複数のモーションを切り替えることができます。
        // たとえば、２つのモーションそれぞれに 0.5 のウェイトを設定すると、２つ
        // のモーションが 50% ずつ合成されたような結果となります。
        // --------------------------------------------------------------------

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

    // 前回からの経過時間（デルタ）を取得してミキサーに適用する @@@
    const delta = this.clock.getDelta();
    // ★★ delta（前回からの差分）
    this.mixer.update(delta);
    // ★★ 前回からこれだけ（delta分だけ）進んだんだね、じゃあアニメはこうなってないとダメだよね、と勝手に進めてくれる。

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
