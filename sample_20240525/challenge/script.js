
// = 016 ======================================================================
// １つ前のサンプルで見たようにエフェクトコンポーザーを使っている場合は、描画さ
// れる順番を管理しているのはエフェクトコンポーザーになります。
// さらに新しいパスをコンポーザーに追加する際には、その順序が非常に重要になりま
// すので、ここでドットスクリーンパスをさらに追加し、それらについてしっかりと理
// 解を深めておきましょう。
// ============================================================================

// 必要なモジュールを読み込み
import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { EffectComposer } from '../lib/EffectComposer.js';
import { RenderPass } from '../lib/RenderPass.js';
// ポストプロセス用のファイルを追加 @@@
import { RenderPixelatedPass } from '../lib/RenderPixelatedPass.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  await app.load01();
  await app.load02();
  await app.load03();
  await app.load04();
  app.render();
}, false);


// 左右の首振りのフラグ
let flag_LR = true;


class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 100.0,
    position: new THREE.Vector3(10.0, 20.0, 50.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0xffffff,
    // clearColor: 0xcccccc,
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
    color: 0xbbbbbb,
  };
  static BLADE01_MATERIAL_PARAM = {
    color: 0xffffff,
  };
  static BLADE02_MATERIAL_PARAM = {
    color: 0xffffff,
  };
  static BLADE03_MATERIAL_PARAM = {
    color: 0xffffff,
  };
  static ENGINE_MATERIAL_PARAM = {
    color: 0xdddddd,
  };
  static FLOOR_MATERIAL_PARAM = {
    color: 0xffffff,
    side: THREE.DoubleSide,
  };
  static WALL_MATERIAL_PARAM = {
    color: 0xffffff,
    side: THREE.DoubleSide,
  };
  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0xffffff,
    near: 1.0,
    far: 40.0,
  };

  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  material;         // マテリアル
  blade01_material;
  blade02_material;
  blade03_material;
  engine_material;
  floor_material;
  wall01_material;
  wall02_material;
  fanBlade01Geometry;
  fanBlade02Geometry;
  fanBlade03Geometry;
  fanBlade01;
  fanBlade02;
  fanBlade03;
  fanEngine01Geometry;
  fanEngine01;
  fanEngine02Geometry;
  fanEngine02;
  fanPillarGeometry;
  fanPillar;
  fanBaseGeometry;
  fanBase;
  floorGeometry;
  floor;
  wall01Geometry;
  wall01;
  wall02Geometry;
  wall02;
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  isDown;           // キーの押下状態用フラグ
  fanBladeGroup;    // グループ
  fanLRGroup;
  fanBaseGroup;
  composer;         // エフェクトコンポーザー
  renderPixelatedPass;       // ピクセレートパス

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
    // this.scene.fog = new THREE.Fog(
    //   ThreeApp.FOG_PARAM.color,
    //   ThreeApp.FOG_PARAM.near,
    //   ThreeApp.FOG_PARAM.far
    // );

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
    this.blade01_material = new THREE.MeshPhongMaterial(ThreeApp.BLADE01_MATERIAL_PARAM);
    this.blade02_material = new THREE.MeshPhongMaterial(ThreeApp.BLADE02_MATERIAL_PARAM);
    this.blade03_material = new THREE.MeshPhongMaterial(ThreeApp.BLADE03_MATERIAL_PARAM);
    this.engine_material = new THREE.MeshPhongMaterial(ThreeApp.ENGINE_MATERIAL_PARAM);
    this.floor_material = new THREE.MeshPhongMaterial(ThreeApp.FLOOR_MATERIAL_PARAM);
    this.wall01_material = new THREE.MeshPhongMaterial(ThreeApp.WALL_MATERIAL_PARAM);
    this.wall02_material = new THREE.MeshPhongMaterial(ThreeApp.WALL_MATERIAL_PARAM);

    // グループ
    this.fanBladeGroup = new THREE.Group();
    this.scene.add(this.fanBladeGroup);
    this.fanLRGroup = new THREE.Group();
    this.scene.add(this.fanLRGroup);
    this.fanBaseGroup = new THREE.Group();
    this.scene.add(this.fanBaseGroup);

    // 扇風機
    this.fanBlade01Geometry = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 3, 1, false, 0, 1);
    this.fanBlade01 = new THREE.Mesh(this.fanBlade01Geometry, this.blade01_material);
    this.fanBladeGroup.add(this.fanBlade01);

    this.fanBlade02Geometry = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 3, 1, false, 2.1, 1);
    this.fanBlade02 = new THREE.Mesh(this.fanBlade02Geometry, this.blade02_material);
    this.fanBladeGroup.add(this.fanBlade02);

    this.fanBlade03Geometry = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 3, 1, false, 4.2, 1);
    this.fanBlade03 = new THREE.Mesh(this.fanBlade03Geometry, this.blade03_material);
    this.fanBladeGroup.add(this.fanBlade03);

    this.fanEngine02Geometry = new THREE.CylinderGeometry(0.6, 0.6, 0.5);
    this.fanEngine02 = new THREE.Mesh(this.fanEngine02Geometry, this.engine_material);
    this.fanBladeGroup.add(this.fanEngine02);
    this.fanBladeGroup.position.set(0.0, 1.75, 0);
    
    this.fanEngine01Geometry = new THREE.CylinderGeometry(1.0, 1.0, 3.0);
    this.fanEngine01 = new THREE.Mesh(this.fanEngine01Geometry, this.engine_material);
    this.fanLRGroup.add(this.fanEngine01);
    this.fanLRGroup.add(this.fanBladeGroup);
    this.fanLRGroup.rotation.x = Math.PI/2;// 90度回転
    this.fanLRGroup.position.set(0.0, 10.25, -1.0);

    this.fanPillarGeometry = new THREE.CylinderGeometry(0.4, 0.4, 10.0);
    this.fanPillar = new THREE.Mesh(this.fanPillarGeometry, this.material);
    this.fanBaseGroup.add(this.fanPillar);
    this.fanPillar.position.set(0.0, 5.25, -1.0);

    this.fanBaseGeometry = new THREE.CylinderGeometry(3.4, 3.4, 0.5);
    this.fanBase = new THREE.Mesh(this.fanBaseGeometry, this.material);
    this.fanBaseGroup.add(this.fanBase);
    this.fanBase.position.set(0.0, 0.25, 0.0);

    // 床
    this.floorGeometry = new THREE.PlaneGeometry(50, 50);
    this.floor = new THREE.Mesh(this.floorGeometry, this.floor_material);
    this.scene.add(this.floor);
    this.floor.rotation.x = Math.PI/2*-1;// -90度回転
    this.floor.position.set(0.0, 0, 10.0);

    // 壁 後ろ
    this.wall01Geometry = new THREE.PlaneGeometry(50, 30);
    this.wall01 = new THREE.Mesh(this.wall01Geometry, this.wall01_material);
    this.scene.add(this.wall01);
    this.wall01.position.set(0.0, 15.0, -15.0);

    // 壁 左
    this.wall02Geometry = new THREE.PlaneGeometry(50, 30);
    this.wall02 = new THREE.Mesh(this.wall02Geometry, this.wall02_material);
    this.scene.add(this.wall02);
    this.wall02.rotation.y = Math.PI/2;// 90度回転
    this.wall02.position.set(-25.0, 15.0, 10.0);






    // 軸ヘルパー
    const axesBarLength = 20.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // コンポーザーの設定 @@@
    // 1. コンポーザーにレンダラを渡して初期化する
    this.composer = new EffectComposer(this.renderer);
    // 2. コンポーザーに、まず最初に「レンダーパス」を設定する
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    // ピクセレートパス（第一引数はピクセルの粒度）
    this.renderPixelatedPass = new RenderPixelatedPass(10, this.scene, this.camera);
    // this.composer.addPass(this.renderPixelatedPass);
    // 5. パスの追加がすべて終わったら画面に描画結果を出すよう指示する
    // this.renderPixelatedPass.renderToScreen = true;

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

    // ピクセレートパス関係
    this.isCheck = false;
    const checkbox = document.getElementById('switch');
    checkbox.addEventListener('click', () => {
      const title = document.querySelector('.title');
      title.textContent = checkbox.checked ? 'ON' : 'OFF';
      // checkboxでピクセレートパスをコントロール。
      if(this.isCheck === false) {
        this.composer.addPass(this.renderPixelatedPass);
        this.isCheck = true;
      } else {
        this.composer.removePass(this.renderPixelatedPass);
        this.isCheck = false;
      }
    });

    // ウィンドウのリサイズを検出できるようにする
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load01() {
    return new Promise((resolve) => {
      const imagePath = './sample02.jpg';
      const loader = new THREE.TextureLoader();
      loader.load(imagePath, (texture) => {
        // this.material.map = texture;
        this.blade01_material.map = texture;
        this.blade02_material.map = texture;
        this.blade03_material.map = texture;
        resolve();
      });
    });
  }
  // 床用のテクスチャ
  load02() {
    return new Promise((resolve) => {
      const imagePath = './sample03.jpg';
      const loader = new THREE.TextureLoader();
      loader.load(imagePath, (texture) => {
        this.floor_material.map = texture;
        resolve();
      });
    });
  }
  // 壁:後ろ用のテクスチャ
  load03() {
    return new Promise((resolve) => {
      const imagePath = './sample04.jpg';
      const loader = new THREE.TextureLoader();
      loader.load(imagePath, (texture) => {
        this.wall01_material.map = texture;
        resolve();
      });
    });
  }
  // 壁：左用のテクスチャ
  load04() {
    return new Promise((resolve) => {
      const imagePath = './sample05.jpg';
      const loader = new THREE.TextureLoader();
      loader.load(imagePath, (texture) => {
        this.wall02_material.map = texture;
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

      // ピクセレートパスを解除する。
      // this.composer.removePass(this.renderPixelatedPass);
      // // this.composer.addPass(this.renderPixelatedPass);

      // 羽の回転
      this.fanBladeGroup.rotation.y += 0.4;

      // 左右の首振り
      if(this.fanLRGroup.rotation.z >= 1.3) {
        flag_LR = false;
      } else if(this.fanLRGroup.rotation.z <= -1.3) {
        flag_LR = true;
      }
      if(flag_LR) {
        this.fanLRGroup.rotation.z += 0.02;
      } else {
        this.fanLRGroup.rotation.z -= 0.02;
      }

      // this.scene.fog.far += 0.5;
      // console.log(this.scene.fog.far);
    }

    // レンダラーではなく、コンポーザーに対して描画を指示する
    this.composer.render();
  }
}
