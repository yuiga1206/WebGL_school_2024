
// = 002 ======================================================================
// まず最初に、描画結果を確認しやすくするために、マウスで描画結果に干渉できるよ
// うにしておきましょう。
// three.js には、カメラを操作するためのコントロールと呼ばれる補助機能が用意され
// ているので、それを読み込んで利用します。
// より具体的には、ここでは OrbitControls と名付けられたコントロールを使っていま
// す。three.js には他のコントロールもありますが、最も直感的な動作をしてくれるの
// がオービットコントロールだと思います。
// ============================================================================

// - three.js と examples -----------------------------------------------------
// three.js には、たくさんのユーティリティがあります。
// ソースコードのリポジトリ内、examples フォルダ以下にある実装は実は three.js の
// 本体ではなく、ユーティリティです。このフォルダ内には各種のファイルをロードす
// るためのローダーや、エフェクトを掛けるためのシェーダ、さらには今回のサンプル
// で利用している各種コントローラーなどが含まれます。
// これらのユーティリティを利用する場合、three.js 本体を読み込むだけでなく対象の
// ファイルを別途読み込む必要がありますので注意しましょう。
// ----------------------------------------------------------------------------

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js'; // @@@
// ★★ カメラを動かすことが出来るようになる。three.jsを補助する機能郡の一部。

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
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 10.0,
    position: new THREE.Vector3(0.0, 2.0, 5.0),
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
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0x3399ff, // マテリアルの基本色
  };

  renderer; // レンダラ
  scene;    // シーン
  camera;   // カメラ
  geometry; // ジオメトリ
  material; // マテリアル
  box;      // ボックスメッシュ
  controls; // オービットコントロール @@@
  // ★★ 代入するためのプロパティを作っておく。

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

    // ジオメトリとマテリアル
    this.geometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    this.material = new THREE.MeshBasicMaterial(ThreeApp.MATERIAL_PARAM);

    // メッシュ
    this.box = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.box);

    // コントロール @@@
    // - OrbitControls --------------------------------------------------------
    // オービット、とはいわゆる衛星などの軌道のことです。
    // 地球を中心にその周囲を飛び回る衛星と同じように、三次元空間のある一点を凝
    // 視しながらその周囲を回転するカメラコントロールを可能にします。
    // ------------------------------------------------------------------------
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // ★★ canvasの上で動かせるカメラを生成する。

    // render メソッドはブラウザ制御で再帰的に呼び出されるので this を固定する @@@
    // - JavaScript における this ---------------------------------------------
    // 初心者向けのドキュメントなどで、よく JavaScript の this は紛らわしいもの
    // として紹介されます。実際、JavaScript では this が原因で不具合が混入してし
    // まうことはよく起こります。
    // 以下の一文も、そんな不具合を解消するためのコードでこれを削除してしまうと
    // 正しく動作しなくなってしまいます。
    // ここでは「JavaScript の this は呼び出し元によって動的に変化する」という特
    // 性を踏まえ、あらかじめ this を固定するということを行っています。
    // ------------------------------------------------------------------------
    this.render = this.render.bind(this);
    // ★★ コンストラクタの中なので、thisは絶対に自分なので、ここでbindしてる。
  }

  /**
   * 描画処理
   */
  render() {
    // - requestAnimationFrame で描画する -------------------------------------
    // PC などのディスプレイは、いわゆるパラパラ漫画の要領で素早く画面に描画され
    // る内容を更新しています。
    // どのくらいの頻度で画面を更新するかはおおよそ決まっていて、一般に１秒間に
    // ６０回更新する場合が多いです。（ゲーム用ディスプレイなど例外もある）
    // requestAnimationFrame は、このディスプレイの更新頻度に連動して関数を呼び
    // 出すために用いられ、引数に与えられた関数は次の画面の更新に合わせて実行さ
    // れます。
    // ここでは requestAnimationFrame に render メソッドを指定することで、画面が
    // 更新されると同時に再度 render が呼ばれるようにしています。
    // ------------------------------------------------------------------------
    // 恒常ループの設定 @@@
    // ★★ 引数に与えられた関数を、次の画面の更新時に呼び出してくれる。
    requestAnimationFrame(this.render);// ★★ ブラウザのjsとして、グローバルにある関数。thisがついていない。
    // ★★ ブラウザが自動的に、次回の更新に合わせて、レンダリングしてくれる。

    // ★★ 固定していないと二回目のthisがアンディファインドになる。
    // ★★ 最初はappがrenderを呼んでいる。だからthisはThreeAppになる。
    // ★★ しかしrequestAnimationFrameを二回目に呼ぶときは、jsが勝手にrenderを呼んでいるので、thisがなくなる。
    // ★★ なので「this.render = this.render.bind(this);」というようにthisを固定する。

    // ★★ アロー関数で書くことで、this.render.bind(this) を省略できる？
    // ★★ requestAnimationFrame(() => {
    // ★★   this.render();
    // ★★ });
    // ★★ 無駄な関数が毎回作られると思ってしまうので、やらない…。書けるは書ける。

    // ★★ アロー関数を使うとthisが固定される。
    // ★★ jsのそういう仕様です…。
    // ★★ 一回目の正しいthisのときにthisが固定されるので、「thisが固定される」ということ。
    // ★★ ↓この状態だとthisは固定されない。あくまでアロー関数だけ！
    // ★★ requestAnimationFrame(function(){
    // ★★   this.render();
    // ★★ });




    // コントロールを更新 @@@
    this.controls.update();
    // ★★ カメラの位置が動いて……

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
    // ★★ カメラの位置が動いて……レンダリングする。
  }
}

