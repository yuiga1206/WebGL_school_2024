
// = 025 ======================================================================
// three.js では、あらかじめ形状が定義されているジオメトリを用いる方法だけでなく、
// それらの元となっている基底クラスを使って、独自にジオメトリを定義して利用する
// 方法も用意されています。
// たとえばパーティクルを定義したい場合など、既存のジオメトリのような特定の形状
// に依存しない使い方をしたい場合に、こういったアプローチが必要になります。
// 基底クラスは BufferGeometry という名前で、すべてのビルトインジオメトリはこの
// クラスを継承して設計されています。今回はパーティクルを独自に定義する方法を通
// じて BufferGeometry の使い方を見てみましょう。
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
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
    clearColor: 0x000000, // パーティクルが目立つように背景は黒に @@@
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * マテリアル定義のための定数（パーティクル用） @@@
   */
  static MATERIAL_PARAM = {
    color: 0xffffff,      // パーティクルの色
    size: 0.25,           // 基準となるサイズ
    sizeAttenuation: true // 遠近感を出すかどうかの真偽値
  };

  wrapper;          // canvas の親要素
  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  geometry;         // ジオメトリ
  material;         // マテリアル
  points;           // パーティクルの実態（点群のメッシュに相当） @@@
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー

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

    // パーティクル用のマテリアル @@@
    this.material = new THREE.PointsMaterial(ThreeApp.MATERIAL_PARAM);

    // - パーティクルを定義する -----------------------------------------------
    // なんらかの形状をあらかじめ持っているビルトインの各種ジオメトリとは違い
    // BufferGeometry には、最初の段階では一切頂点が含まれていません。
    // この BufferGeometry というオブジェクトは、three.js のすべてのビルトインジ
    // オメトリのベースになっているオブジェクトです。（すべてのジオメトリがこの
    // クラスを継承している）
    // この空のジオメトリに頂点を追加するには、まず配列を用意し、そこに必要な情
    // 報を格納していきます。ここでは最も単純な頂点に関する情報である「頂点座標」
    // をジオメトリに対して追加していく方法を見てみましょう。
    // ------------------------------------------------------------------------
    // パーティクルの定義 @@@
    this.geometry = new THREE.BufferGeometry(); // 特定の形状を持たないジオメトリ
    const COUNT = 10;    // パーティクルの行と列のカウント数
    const WIDTH = 10.0;  // どの程度の範囲に配置するかの幅
    const vertices = []; // まず頂点情報を格納する単なる配列（Array）
    for (let i = 0; i <= COUNT; ++i) {
      // カウンタ変数 i から X 座標を算出
      const x = (i / COUNT - 0.5) * WIDTH;
      for(let j = 0; j <= COUNT; ++j){
        // カウンタ変数 j から Y 座標を算出
        const y = (j / COUNT - 0.5) * WIDTH;
        // 配列に頂点を加える
        vertices.push(x, y, 0.0);
      }
    }
    // - 定義した頂点の情報を加工する -----------------------------------------
    // three.js では、ジオメトリに頂点の情報を設定する（上書きや追加する） 場合
    // は、BufferAttribute というクラスを利用します。
    // また、この BufferAttribute クラスは、データの入力として TypedArray を使い
    // ますので、混乱しないように落ち着いて、どのような処理が行われているのか確
    // 認しましょう。
    // ポイントは、適切な TypedArray を利用すること。また、データの個数がいくつ
    // でワンセットになっているのか（ストライド）を忘れずに指定します。
    // ※ストライドは three.js のドキュメントなどでは itemSize と記載されている
    // ------------------------------------------------------------------------
    // この頂点情報がいくつの要素からなるか（XYZ なので、３を指定）
    const stride = 3;
    // BufferAttribute の生成
    const attribute = new THREE.BufferAttribute(new Float32Array(vertices), stride);
    // position という名前に対して BufferAttribute を割り当てる
    this.geometry.setAttribute('position', attribute);
    // - attribute の名称 -----------------------------------------------------
    // 今回は、頂点の「座標」を TypedArray に変換して、それをジオメトリに対して
    // セットしています。そこで 'position' という名前を指定していますが、これを
    // たとえば 'pos' のように、独自の文言に変更することができるのか、疑問に感じ
    // た方もいたかもしれません。
    // この「頂点に割り当てられている属性値の名称」には、いくつかの制限がありま
    // す。より正確には、内部的に利用されるシェーダの実装に依存します。このあた
    // りの話は、いずれ WebGL のネイティブな API を扱うタイミングで、シェーダに
    // ついての理解が深まると自然となにをやっているのかがわかるようになります。
    // 今回のケースでは、頂点の座標を扱うための名前が three.js では 'position'
    // に固定されているので、それに合わせてこのようになっています。ですから独自
    // に 'pos' のような名前を指定してもうまくいきませんので注意しましょう。
    // ------------------------------------------------------------------------

    // パーティクルを格納したジオメトリとマテリアルからポイントオブジェクトを生成
    // ※ポイントオブジェクトは、頂点１つを「点」として描画するジオメトリの形態です
    this.points = new THREE.Points(this.geometry, this.material);
    // シーンにパーティクルを追加
    this.scene.add(this.points);

    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
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
