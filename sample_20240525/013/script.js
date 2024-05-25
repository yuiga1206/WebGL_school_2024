
// = 013 ======================================================================
// 単に CG の世界でテクスチャと言った場合には、大抵の場合それは画素の集まり、つ
// まり連想しやすいものでいうと「画像」のことを言う場合が多いです。
// three.js でも、やはり画像を読み込んでこれを 3DCG の世界で利用する方法があり、
// その文脈でテクスチャというキーワードが登場します。
// テクスチャ自体は、three.js では非常に簡単に使うことができますが、ブラウザの
// セキュリティ上の理由から、ローカルファイルを直接ブラウザでリソースとして扱う
// ことができないため、ローカルサーバなどを用いて実行してやる必要があります。
// また一連の処理が非同期に行われることにも気をつけましょう。
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);

  // 非同期の読み込み処理 @@@
  await app.load();

  // 読み込み処理が終わったあとで描画を開始 @@@
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
    far: 20.0,
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
    color: 0xffffff, // テクスチャと乗算されるので、白にしておく @@@
  };
  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0xffffff,
    near: 5.0,
    far: 15.0,
  };

  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  material;         // マテリアル
  torusGeometry;    // トーラスジオメトリ
  torusArray;       // トーラスメッシュの配列
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  isDown;           // キーの押下状態用フラグ
  group;            // グループ

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // フォグ
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

    // マテリアル
    this.material = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);

    // グループ
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する
    const torusCount = 10;
    const transformScale = 5.0;
    this.torusGeometry = new THREE.TorusGeometry(0.5, 0.2, 8, 16);
    this.torusArray = [];
    for (let i = 0; i < torusCount; ++i) {
      const torus = new THREE.Mesh(this.torusGeometry, this.material);
      torus.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
      torus.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
      torus.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
      this.group.add(torus);
      this.torusArray.push(torus);
    }

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // this のバインド
    this.render = this.render.bind(this);

    // キーの押下状態を保持するフラグ
    this.isDown = false;

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

    // ウィンドウのリサイズを検出できるようにする
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * アセット（素材）のロードを行う Promise @@@
   */
  load() {
    return new Promise((resolve) => {
      // 読み込む画像のパス
      const imagePath = './sample.jpg';
      // テクスチャ用のローダーのインスタンスを生成
      const loader = new THREE.TextureLoader();
      // ローダーの load メソッドに読み込む画像のパスと、ロード完了時のコールバックを指定
      loader.load(imagePath, (texture) => {
        // コールバック関数のパラメータとして、初期化済みのテクスチャオブジェクトが渡されてくる
        // マテリアルの map プロパティにテクスチャを指定すると、自動でマッピングされる
        this.material.map = texture;
        // - テクスチャに関する補足 -------------------------------------------
        // テクスチャから読み出した色（RGB）は、シェーダと呼ばれる機構のなかで使
        // われます。three.js の場合、通常はシェーダを記述しなくても 3DCG が描画
        // されますが、深いところでは結局シェーダによる処理が実行されています。
        // three.js の MeshPhongMaterial などの場合、テクスチャから読み出した色
        // は、シェーダ内でマテリアルの基本色と乗算されます。
        // 色が乗算される、と言われるとちょっとわかりにくいかもしれませんが RGB
        // の各要素ごとにテクスチャから読み出した色と基本色とで掛け算します。
        // つまり、基本色が仮に黒（0x000000）だとすると、テクスチャから読み出し
        // た色が何色であれ、掛け算ですべてがゼロとなり黒になります。
        // --------------------------------------------------------------------

        // Promise を解決
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

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      this.group.rotation.y += 0.05;
    }

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
