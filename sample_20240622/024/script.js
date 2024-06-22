
// = 024 ======================================================================
// 3D プログラミングをしていると、マウスカーソルでクリックしてオブジェクトを選択
// するなどの「マウスを利用した 3D 空間への干渉」を行いたくなる場面に比較的よく
// 出くわします。
// 本来、このような「三次元空間への干渉」はそこそこしっかり数学を活用しないと実
// 現が難しいものですが、three.js には Raycaster と呼ばれる仕組みがあり、これを
// 用いることで数学の知識があまりなくても、比較的容易に三次元空間への干渉処理を
// 実装することができます。
// ここでは、クリックという操作を契機に、マウスカーソルで指し示したオブジェクト
// の色を変化させてみましょう。
// ============================================================================

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
   * レイが交差した際のマテリアル定義のための定数 @@@
   */
  static INTERSECTION_MATERIAL_PARAM = {
    color: 0x00ff00,
  };
  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0xffffff,
    near: 15.0,
    far: 25.0,
  };

  wrapper;          // canvas の親要素
  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  material;         // マテリアル
  hitMaterial;      // レイが交差した際のマテリアル @@@
  torusGeometry;    // トーラスジオメトリ
  torusArray;       // トーラスメッシュの配列
  texture;          // テクスチャ
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  isDown;           // キーの押下状態用フラグ
  group;            // グループ
  raycaster;        // レイキャスター @@@

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

    // Raycaster のインスタンスを生成する @@@
    this.raycaster = new THREE.Raycaster();
    // マウスのクリックイベントの定義 @@@
    window.addEventListener('click', (mouseEvent) => {
      // スクリーン空間の座標系をレイキャスター用に正規化する（-1.0 ~ 1.0 の範囲）
      // ★★ 画面の中心を原点として、端から端までを-1.0 ~ 1.0とするため。
      const x = mouseEvent.clientX / window.innerWidth * 2.0 - 1.0;
      // ★★ 【mouseEvent.clientX / window.innerWidth】で0 ~ 1の範囲
      // ★★ それを2倍して1引くので、-1.0 ~ 1.0 の範囲
      const y = mouseEvent.clientY / window.innerHeight * 2.0 - 1.0;
      // スクリーン空間は上下が反転している点に注意（Y だけ符号を反転させる）
      // ★★ 下方向がプラスになっているので、Y軸だけ反転させ、上方向をプラスにする。
      const v = new THREE.Vector2(x, -y);
      // レイキャスターに正規化済みマウス座標とカメラを指定する
      this.raycaster.setFromCamera(v, this.camera);
      // ★★ ↑　計算に必要な要素を渡しただけで、計算自体はまだ行われていない
      // scene に含まれるすべてのオブジェクト（ここでは Mesh）を対象にレイキャストする
      // ★★ 【this.raycaster.intersectObject】
      // ★★ 【this.raycaster.intersectObjects】の場合は配列を渡す。
      const intersects = this.raycaster.intersectObjects(this.torusArray);
      // ★★ intersects の中に交差したオブジェクトの情報が入っていく。
      // レイが交差しなかった場合を考慮し一度マテリアルを通常時の状態にリセットしておく
      this.torusArray.forEach((mesh) => {
        mesh.material = this.material;
      });

      // - intersectObjects でレイキャストした結果は配列 ----------------------
      // 名前が似ているので紛らわしいのですが Raycaster には intersectObject と
      // intersectObjects があります。複数形の s がついているかどうかの違いがあ
      // り、複数形の場合は引数と戻り値のいずれも配列になります。
      // この配列の長さが 0 である場合はカーソル位置に向かって放ったレイは、どの
      // オブジェクトとも交差しなかったと判断できます。また、複数のオブジェクト
      // とレイが交差した場合も、three.js 側で並び替えてくれるので 0 番目の要素
      // を参照すれば必ず見た目上の最も手前にあるオブジェクトを参照できます。
      // 戻り値の中身は object というプロパティを経由することで対象の Mesh など
      // のオブジェクトを参照できる他、交点の座標などもわかります。
      // ----------------------------------------------------------------------
      if (intersects.length > 0) {
        intersects[0].object.material = this.hitMaterial;
      }
      // - Raycaster は CPU 上で動作する --------------------------------------
      // WebGL は描画処理に GPU を活用することで高速に動作します。
      // しかし JavaScript は CPU 上で動作するプログラムであり、Raycaster が内部
      // で行っている処理はあくまでも CPU 上で行われます。
      // 原理的には「メッシュを構成するポリゴンとレイが衝突するか」を JavaScript
      // でループして判定していますので、シーン内のメッシュの量やポリゴンの量が
      // 増えると、それに比例して Raycaster のコストも増加します。
      // ----------------------------------------------------------------------
    }, false);

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
    this.material.map = this.texture;
    // 交差時に表示するためのマテリアルを定義 @@@
    this.hitMaterial = new THREE.MeshPhongMaterial(ThreeApp.INTERSECTION_MATERIAL_PARAM);
    this.hitMaterial.map = this.texture;

    // グループ
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // トーラスメッシュ
    const torusCount = 10;
    const transformScale = 5.0;
    this.torusGeometry = new THREE.TorusGeometry(0.5, 0.2, 8, 16);
    this.torusArray = [];
    for (let i = 0; i < torusCount; ++i) {
      const torus = new THREE.Mesh(this.torusGeometry, this.material);
      torus.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
      torus.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
      torus.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
      // ★★ this.name = `t-$(i)`; //で名前をつける
      this.group.add(torus);
      this.torusArray.push(torus);
    }

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // キーの押下状態を保持するフラグ
    this.isDown = false;
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    return new Promise((resolve) => {
      const imagePath = './sample.jpg';
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

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      this.group.rotation.y += 0.05;
    }

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
