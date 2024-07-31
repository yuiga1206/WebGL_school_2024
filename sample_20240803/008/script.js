
// = 008 ======================================================================
// three.js では、OrbitControls を用いることで手軽にマウスによるカメラ制御を取り
// 入れることができました。
// これに相当する機能を自作するには、カメラを自在に制御するための数学的な知識が
// 必要となります。これはなかなか骨の折れる実装作業で、難易度は消して低くはあり
// ません。
// 今回以降、マウスによるインタラクティブなカメラ操作が使えないと動作確認などに
// 支障をきたす可能性が高いので、サンプルとしてあらかじめオービットコントロール
// のような挙動をするカメラ機能を実装して組み込みました。
// より厳密には、ビュー座標変換行列を生成する機能だけを持ったシンプルなカメラク
// ラスになっています。※詳細は camera.js を参照
// three.js とは異なり、WebGL の API にはカメラという概念があらかじめ用意されて
// いるわけではありませんので注意しましょう。
// ============================================================================

// モジュールを読み込み
import { WebGLUtility } from '../lib/webgl.js';
import { Vec3, Mat4 } from '../lib/math.js';
import { WebGLGeometry } from '../lib/geometry.js';
import { WebGLOrbitCamera } from '../lib/camera.js';

// ドキュメントの読み込みが完了したら実行されるようイベントを設定する
window.addEventListener('DOMContentLoaded', async () => {
  // アプリケーションのインスタンスを初期化し、必要なリソースをロードする
  const app = new App();
  app.init();
  await app.load();
  // ロードが終わったら各種セットアップを行う
  app.setupGeometry();
  app.setupLocation();
  // すべてのセットアップが完了したら描画を開始する
  app.start();
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;            // WebGL で描画を行う canvas 要素
  gl;                // WebGLRenderingContext （WebGL コンテキスト）
  program;           // WebGLProgram （プログラムオブジェクト）
  attributeLocation; // attribute 変数のロケーション
  attributeStride;   // attribute 変数のストライド
  planeGeometry;     // 板ポリゴンのジオメトリ情報
  planeVBO;          // 板ポリゴンの頂点バッファ
  planeIBO;          // 板ポリゴンのインデックスバッファ
  uniformLocation;   // uniform 変数のロケーション
  startTime;         // レンダリング開始時のタイムスタンプ
  isRendering;       // レンダリングを行うかどうかのフラグ
  camera;            // WebGLOrbitCamera のインスタンス @@@

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
  }

  /**
   * 初期化処理を行う
   */
  init() {
    // canvas エレメントの取得と WebGL コンテキストの初期化
    this.canvas = document.getElementById('webgl-canvas');
    this.gl = WebGLUtility.createWebGLContext(this.canvas);

    // カメラ制御用インスタンスを生成する @@@
    const cameraOption = {
      distance: 3.0, // Z 軸上の初期位置までの距離
      min: 1.0,      // カメラが寄れる最小距離
      max: 10.0,     // カメラが離れられる最大距離
      move: 2.0,     // 右ボタンで平行移動する際の速度係数
    };
    this.camera = new WebGLOrbitCamera(this.canvas, cameraOption);

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);
  }

  /**
   * リサイズ処理
   */
  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      const gl = this.gl;
      if (gl == null) {
        // もし WebGL コンテキストがない場合はエラーとして Promise を reject する
        const error = new Error('not initialized');
        reject(error);
      } else {
        // シェーダのソースコードを読み込みシェーダとプログラムオブジェクトを生成する
        const VSSource = await WebGLUtility.loadFile('./main.vert');
        const FSSource = await WebGLUtility.loadFile('./main.frag');
        const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
        const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);
        this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);
        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // 板ポリゴンのジオメトリ情報を取得
    const width = 1.0;
    const height = 0.5;
    const color = [1.0, 0.0, 0.0, 1.0];
    this.planeGeometry = WebGLGeometry.plane(width, height, color);

    // VBO と IBO を生成する
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.color),
    ];
    this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得
    this.attributeLocation = [
      gl.getAttribLocation(this.program, 'position'),
      gl.getAttribLocation(this.program, 'color'),
    ];
    // attribute のストライド
    this.attributeStride = [
      3,
      4,
    ];
    // uniform location の取得
    this.uniformLocation = {
      mvpMatrix: gl.getUniformLocation(this.program, 'mvpMatrix'),
      time: gl.getUniformLocation(this.program, 'time'),
    };
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // バックフェイスカリングは今回は無効化 @@@
    gl.disable(gl.CULL_FACE);
    // 深度テストの有効化
    gl.enable(gl.DEPTH_TEST);
  }

  /**
   * 描画を開始する
   */
  start() {
    // レンダリング開始時のタイムスタンプを取得しておく
    this.startTime = Date.now();
    // レンダリングを行っているフラグを立てておく
    this.isRendering = true;
    // レンダリングの開始
    this.render();
  }

  /**
   * 描画を停止する
   */
  stop() {
    this.isRendering = false;
  }

  /**
   * レンダリングを行う
   */
  render() {
    const gl = this.gl;

    // レンダリングのフラグの状態を見て、requestAnimationFrame を呼ぶか決める
    if (this.isRendering === true) {
      requestAnimationFrame(this.render);
    }

    // 現在までの経過時間
    const nowTime = (Date.now() - this.startTime) * 0.001;

    // レンダリングのセットアップ
    this.setupRendering();

    // - 各種行列を生成する ---------------------------------------------------
    // モデル座標変換行列
    const rotateAxis = Vec3.create(0.0, 1.0, 0.0);               // Y 軸回転を掛ける
    const m = Mat4.rotate(Mat4.identity(), nowTime, rotateAxis); // 時間の経過が回転量

    // ビュー座標変換行列はカメラクラス（の更新処理の戻り値）から取得する @@@
    const v = this.camera.update();

    // プロジェクション座標変換行列
    const fovy   = 45;                                     // 視野角（度数）
    const aspect = window.innerWidth / window.innerHeight; // アスペクト比
    const near   = 0.1;                                    // ニア・クリップ面までの距離
    const far    = 10.0;                                   // ファー・クリップ面までの距離
    const p = Mat4.perspective(fovy, aspect, near, far);

    // 行列を乗算して MVP 行列を生成する（掛ける順序に注意）
    const vp = Mat4.multiply(p, v);
    const mvp = Mat4.multiply(vp, m);
    // ------------------------------------------------------------------------

    // プログラムオブジェクトを選択
    gl.useProgram(this.program);

    // ロケーションを指定して、uniform 変数の値を更新する
    gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
    gl.uniform1f(this.uniformLocation.time, nowTime);

    // VBO と IBO を設定し、描画する
    WebGLUtility.enableBuffer(gl, this.planeVBO, this.attributeLocation, this.attributeStride, this.planeIBO);
    gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
  }
}
