
// = 課題： ======================================================================
// ■ Box Geometry を利用すること
// ■ ボックスが画面上に100個以上描かれるようにすること
// ■ まっすぐ並べてもいいし......ランダムでもいい(配置の仕方は自由)
// ■ 色や大きさなどは自由
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  app.render();
}, false);

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    // fovy は Field of View Y のことで、縦方向の視野角を意味する
    fovy: 60,
    // 描画する空間のアスペクト比（縦横比）
    aspect: window.innerWidth / window.innerHeight,
    // 描画する空間のニアクリップ面（最近面）
    near: 0.1,
    // 描画する空間のファークリップ面（最遠面）
    far: 50.0,
    // カメラの座標
    position: new THREE.Vector3(0.0, 2.0, 30.0),
    // カメラの注視点
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x666666,       // 画面をクリアする色
    width: window.innerWidth,   // レンダラーに設定する幅
    height: window.innerHeight, // レンダラーに設定する高さ
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,                            // 光の色
    intensity: 1.0,                             // 光の強度
    position: new THREE.Vector3(1.0, 1.0, 1.0), // 光の向き
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff, // 光の色
    intensity: 0.1,  // 光の強度
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0x3399ff, // マテリアルの基本色
  };

  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  material;         // マテリアル
  // torusGeometry;    // トーラスジオメトリ
  // torusArray;       // トーラスメッシュの配列 @@@
  boxGeometry;      // ボックスジオメトリ
  boxArray01;       // ボックスメッシュの配列
  boxArray02;       // ボックスメッシュの配列
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  isDown;           // キーの押下状態用フラグ

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
    this.material = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);// ★★ ループの外に書くこと！使い回すので1度の記述で良いので、ループの中に書かない。

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する @@@
    // const torusCount = 100;
    // const transformScale = 5.0;
    // this.torusGeometry = new THREE.TorusGeometry(0.5, 0.2, 8, 16);// ★★ ループの外に書くこと！使い回すので1度の記述で良いので、ループの中に書かない。
    // this.torusArray = [];
    // for (let i = 0; i < torusCount; ++i) {
    //   // トーラスメッシュのインスタンスを生成
    //   const torus = new THREE.Mesh(this.torusGeometry, this.material);
    //   // 座標をランダムに散らす
    //   torus.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
    //   torus.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
    //   torus.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
    //   // シーンに追加する
    //   this.scene.add(torus);
    //   // 配列に入れておく
    //   this.torusArray.push(torus);
    // }
    const boxCount = 136;
    const transformScale = 5.0;
    this.boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    this.boxArray01 = [];
    this.boxArray02 = [];
    for (let i = 0; i < boxCount; ++i) {
      // トーラスメッシュのインスタンスを生成
      const box = new THREE.Mesh(this.boxGeometry, this.material);
      // 座標をランダムに散らす
      // box.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
      // box.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
      // box.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
      box.position.x = i + 1;
      // x軸の指定
      switch (i) {
        case 6: case 22: case 26: case 31: case 74: case 90: case 94: case 99:
          box.position.x = -17;
          break;
        case 7: case 75:
          box.position.x = -16;
          break;
        case 8: case 76:
          box.position.x = -15;
          break;
        case 9: case 62: case 77: case 130:
          box.position.x = -14;
          break;
        case 0: case 3: case 10: case 63: case 68: case 71: case 78: case 131:
          box.position.x = -13;
          break;
      
        default:
          break;
      }
      // y軸の指定
      switch (i) {
        case 0: case 1: case 2: case 68: case 69: case 70:
          box.position.y = 6;
          break;
        case 3: case 4: case 5: case 71: case 72: case 73:
          box.position.y = 5;
          break;
      
        default:
          break;
      }
      if (i < 68) {
        this.scene.add(box);
        this.boxArray01.push(box);
      } else {
        box.position.z = -1;
        this.scene.add(box);
        this.boxArray02.push(box);
      }
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
   * 描画処理
   */
  render() {
    // 恒常ループの設定
    requestAnimationFrame(this.render);

    // コントロールを更新
    this.controls.update();

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      // Y 軸回転 @@@
      // this.torusArray.forEach((torus) => {
      //   torus.rotation.y += 0.05;
      // });
      this.boxArray01.forEach((box) => {
        box.rotation.y += 0.05;
      });
      this.boxArray02.forEach((box) => {
        box.rotation.y += 0.03;
      });
    }

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}

