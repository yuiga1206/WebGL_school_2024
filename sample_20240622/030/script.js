
// = 030 ======================================================================
// 影は、現代の CG では当たり前のように描画されていることが多いですが、実はかな
// り実装難易度の高い技術に分類されます。
// 3DCG の基礎を理解していない場合、原理を説明されたとしてもそれを理解することが
// 難しい場合が多いです。ここではあくまでも three.js の場合のお作法を押さえてお
// きましょう。
// 最低限、影を落とすための設定としてなにをしないといけないのか、というのがまず
// 項目が多くて難しいのですが、１つ１つ落ち着いてポイントを押さえていきましょう。
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
    far: 1000.0,
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
    // 影を使う場合は、ディレクショナルライトであっても位置が重要になる @@@
    position: new THREE.Vector3(50.0, 50.0, 50.0),
    // - 平行光源の position プロパティ ---------------------------------------
    // 一般的な解釈として、平行光源は「無限遠から降り注ぎ、ワールド座標に関係な
    // く水平に降り注ぐ光」というように考えます。
    // 現実世界で言えば、太陽の光のような光源と言えます。
    // そのような前提で考えると、平行光源には厳密には位置という概念がなく、実際
    // three.js においても通常の平行光源は位置ベクトルを向きベクトルのように扱う
    // ことで陰影を計算しています。（位置ベクトルを単位化してライティングに用い
    // ている）
    // しかし、こと影を描画する場合にはその仕組み上、光源の位置にカメラを置いた
    // ような状態を考えるため、位置の概念が重要になります。ライトのヘルパーを使
    // うとそのあたりが可視化され理解の助けになるので、まず最初はヘルパーを上手
    // に活用しながら理解・把握するのがよいでしょう。
    // ------------------------------------------------------------------------
  };
  /**
   * 影に関する定数の定義 @@@
   */
  static SHADOW_PARAM = {
    spaceSize: 100.0, // 影を生成するためのカメラの空間の広さ
    mapSize: 512,     // 影を生成するためのバッファのサイズ
    // - 影を生成するためのバッファとは ---------------------------------------
    // 影を生成する原理は、ものすごく簡単に言えば「距離を格納したバッファの中身
    // と実際の値を比較して、遮蔽物があるか調べる」ということを行っています。
    // このとき、バッファが高解像度であれば、当然ながら影かそうでないかがより高
    // 精細にチェックされることになるので、きれいな影が出ます。
    // 一方で、バッファを高解像度にするということはそれだけ負荷が高くなります。
    // mapSize は大きすぎる数値を指定すると一気にパフォーマンスが下がるので注意
    // が必要です。
    // ------------------------------------------------------------------------
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
  mixer;            // アニメーションミキサー
  actions;          // アニメーションのアクション
  clock;            // アニメーション用のクロック
  plane;            // 床面用プレーン @@@
  cameraHelper;     // 影のデバッグ用ヘルパー @@@

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

    // レンダラーで影を描画するための機能を有効化する @@@
    this.renderer.shadowMap.enabled = true;

    // レンダラーに対しては影の描画アルゴリズムを指定できる @@@
    // ※ちなみに既定値は THREE.PCFShadowMap なので、以下は省略可
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

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

    // ディレクショナルライトが影を落とすように設定する @@@
    this.directionalLight.castShadow = true;

    // 影用のカメラ（平行投影のカメラ）は必要に応じて範囲を広げる @@@
    this.directionalLight.shadow.camera.top    =  ThreeApp.SHADOW_PARAM.spaceSize;
    this.directionalLight.shadow.camera.bottom = -ThreeApp.SHADOW_PARAM.spaceSize;
    this.directionalLight.shadow.camera.left   = -ThreeApp.SHADOW_PARAM.spaceSize;
    this.directionalLight.shadow.camera.right  =  ThreeApp.SHADOW_PARAM.spaceSize;

    // 影用のバッファのサイズは変更することもできる @@@
    this.directionalLight.shadow.mapSize.width  = ThreeApp.SHADOW_PARAM.mapSize;
    this.directionalLight.shadow.mapSize.height = ThreeApp.SHADOW_PARAM.mapSize;

    // ライトの設定を可視化するためにヘルパーを使う @@@
    this.cameraHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
    this.scene.add(this.cameraHelper);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // シーンに glTF を追加
    this.scene.add(this.gltf.scene);

    // glTF の階層構造をたどり、Mesh が出てきたら影を落とす（cast）設定を行う @@@
    this.gltf.scene.traverse((object) => {
      if (object.isMesh === true || object.isSkinnedMesh === true) {
        object.castShadow = true;
      }
    });

    // 床面をプレーンで生成する @@@
    const planeGeometry = new THREE.PlaneGeometry(250.0, 250.0);
    const planeMaterial = new THREE.MeshPhongMaterial();
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // プレーンは XY 平面に水平な状態なので、後ろに 90 度分倒す
    this.plane.rotation.x = -Math.PI * 0.5;

    // 床面は、影を受ける（receive）するよう設定する @@@
    this.plane.receiveShadow = true;

    // シーンに追加
    this.scene.add(this.plane);

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
        // glTF のロードが終わったらアニメーション関連の初期化を同時に行う
        this.gltf = gltf;
        this.mixer = new THREE.AnimationMixer(this.gltf.scene);
        const animations = this.gltf.animations;
        this.actions = [];
        for(let i = 0; i < animations.length; ++i){
          this.actions.push(this.mixer.clipAction(animations[i]));
          this.actions[i].setLoop(THREE.LoopRepeat);
          this.actions[i].play();
          this.actions[i].weight = 0.0;
        }
        this.actions[0].weight = 1.0;
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

    // 前回からの経過時間（デルタ）を取得してミキサーに適用する
    const delta = this.clock.getDelta();
    this.mixer.update(delta);

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
