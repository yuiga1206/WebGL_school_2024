
// = 017 ======================================================================
// CG の世界に欠かせない概念の１つに「ポストエフェクト」または「ポストプロセス」
// と呼ばれる概念があります。
// これを実現するための機構として WebGL にはフレームバッファと呼ばれるオブジェク
// トと、それを利用する API が用意されています。フレームバッファを用いれば、一度
// 完成したグラフィックスに対して、事後処理を施して質感などを変化させることがで
// きるようになり、表現力が大幅に強化されます。
// three.js で言うと、WebGLRenderTarget に相当する機能だといえます。
// WebGL あるあるですが、初期化処理はそれなりに手続きが多く複雑です。
// また、ポストエフェクトを実現するためには必然的にシェーダを同時に２組利用する
// ことになるので、それに関連する諸々の手続きも一気に増えます。落ち着いて読み解
// いていきましょう。
// ============================================================================

import { WebGLUtility } from '../lib/webgl.js';
import { Vec3, Mat4 } from '../lib/math.js';
import { WebGLGeometry } from '../lib/geometry.js';
import { WebGLOrbitCamera } from '../lib/camera.js';
import { Pane } from '../lib/tweakpane-4.0.3.min.js';

window.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  app.init();
  app.setupPane();
  await app.load();
  app.setupGeometry();
  app.setupLocation();
  app.start();
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;               // WebGL で描画を行う canvas 要素
  gl;                   // WebGLRenderingContext （WebGL コンテキスト）
  renderProgram;        // 最終シーン用プログラムオブジェクト
  renderAttLocation;    // 最終シーン用の attribute 変数のロケーション
  renderAttStride;      // 最終シーン用の attribute 変数のストライド
  renderUniLocation;    // 最終シーン用の uniform 変数のロケーション
  offscreenProgram;     // オフスクリーン用のプログラムオブジェクト
  offscreenAttLocation; // オフスクリーン用の attribute 変数のロケーション
  offscreenAttStride;   // オフスクリーン用の attribute 変数のストライド
  offscreenUniLocation; // オフスクリーン用の uniform 変数のロケーション
  cubeGeometry;         // キューブのジオメトリ情報
  cubeVBO;              // キューブの頂点バッファ
  cubeIBO;              // キューブのインデックスバッファ
  torusGeometry;        // トーラスのジオメトリ情報
  torusVBO;             // トーラスの頂点バッファ
  torusIBO;             // トーラスのインデックスバッファ
  startTime;            // レンダリング開始時のタイムスタンプ
  camera;               // WebGLOrbitCamera のインスタンス
  isRendering;          // レンダリングを行うかどうかのフラグ
  isRotation;           // トーラスを回転させるかどうかのフラグ
  framebufferObject;    // フレームバッファに関連するオブジェクト

  // フレームバッファの大きさを指定する定数
  // ※効果をわかりやすくするため、あえて低解像度に設定 @@@
  static BUFFER_SIZE = 128;

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

    // カメラ制御用インスタンスを生成する
    const cameraOption = {
      distance: 5.0, // Z 軸上の初期位置までの距離
      min: 1.0,      // カメラが寄れる最小距離
      max: 10.0,     // カメラが離れられる最大距離
      move: 2.0,     // 右ボタンで平行移動する際の速度係数
    };
    this.camera = new WebGLOrbitCamera(this.canvas, cameraOption);

    // フレームバッファと関連するオブジェクトを生成する @@@
    // 128px司法の正方形のフレームバッファを作る
    this.framebufferObject = WebGLUtility.createFramebuffer(this.gl, App.BUFFER_SIZE, App.BUFFER_SIZE);

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // バックフェイスカリングと深度テストは初期状態で有効
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);

    // 初期状態ではトーラスが回転するように設定する
    this.isRotation = true;
  }

  /**
   * tweakpane の初期化処理
   */
  setupPane() {
    // Tweakpane を使った GUI の設定
    const pane = new Pane();
    const parameter = {
      rotation: this.isRotation,
    };
    // 回転させるかどうか @@@
    pane.addBinding(parameter, 'rotation')
    .on('change', (v) => {
      this.isRotation = v.value;
    });
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
        // 最終シーン用のシェーダ @@@ // ★★ ボックスを描画してる方
        const renderVSSource = await WebGLUtility.loadFile('./render.vert')
        const renderFSSource = await WebGLUtility.loadFile('./render.frag')
        const renderVertexShader = WebGLUtility.createShaderObject(gl, renderVSSource, gl.VERTEX_SHADER);
        const renderFragmentShader = WebGLUtility.createShaderObject(gl, renderFSSource, gl.FRAGMENT_SHADER);
        this.renderProgram = WebGLUtility.createProgramObject(gl, renderVertexShader, renderFragmentShader);
        // オフスクリーン用のシェーダ @@@
        const offscreenVSSource = await WebGLUtility.loadFile('./offscreen.vert')
        const offscreenFSSource = await WebGLUtility.loadFile('./offscreen.frag')
        const offscreenVertexShader = WebGLUtility.createShaderObject(gl, offscreenVSSource, gl.VERTEX_SHADER);
        const offscreenFragmentShader = WebGLUtility.createShaderObject(gl, offscreenFSSource, gl.FRAGMENT_SHADER);
        this.offscreenProgram = WebGLUtility.createProgramObject(gl, offscreenVertexShader, offscreenFragmentShader);

        // 質感をそれぞれ分けたいので、シェーダをそれぞれ別にしている。
        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    const color = [1.0, 1.0, 1.0, 1.0];

    // cube は this.renderProgram と一緒に使う @@@
    const size = 2.0;
    this.cubeGeometry = WebGLGeometry.cube(size, color);
    this.cubeVBO = [
      WebGLUtility.createVBO(this.gl, this.cubeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.cubeGeometry.texCoord),
    ];
    this.cubeIBO = WebGLUtility.createIBO(this.gl, this.cubeGeometry.index);

    // torus は this.offscreenProgram と一緒に使う @@@
    const segment = 64;
    const inner = 0.4;
    const outer = 0.8;
    this.torusGeometry = WebGLGeometry.torus(segment, segment, inner, outer, color);
    this.torusVBO = [
      WebGLUtility.createVBO(this.gl, this.torusGeometry.position),
      WebGLUtility.createVBO(this.gl, this.torusGeometry.normal),
    ];
    this.torusIBO = WebGLUtility.createIBO(this.gl, this.torusGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う @@@
   */
  setupLocation() {
    const gl = this.gl;
    // レンダリング用のセットアップ
    this.renderAttLocation = [
      gl.getAttribLocation(this.renderProgram, 'position'),
      gl.getAttribLocation(this.renderProgram, 'texCoord'),
    ];
    this.renderAttStride = [3, 2];
    this.renderUniLocation = {
      mvpMatrix: gl.getUniformLocation(this.renderProgram, 'mvpMatrix'),     // MVP 行列
      textureUnit: gl.getUniformLocation(this.renderProgram, 'textureUnit'), // テクスチャユニット
    };

    // オフスクリーン用のセットアップ
    this.offscreenAttLocation = [
      gl.getAttribLocation(this.offscreenProgram, 'position'),
      gl.getAttribLocation(this.offscreenProgram, 'normal'),
    ];
    this.offscreenAttStride = [3, 3];
    this.offscreenUniLocation = {
      mvpMatrix: gl.getUniformLocation(this.offscreenProgram, 'mvpMatrix'),       // MVP 行列
      normalMatrix: gl.getUniformLocation(this.offscreenProgram, 'normalMatrix'), // 法線変換用行列
      lightVector: gl.getUniformLocation(this.offscreenProgram, 'lightVector'),   // ライトベクトル
    };
  }

  /**
   * 最終シーンレンダリングのためのセットアップを行う @@@
   */
  setupRendering() {
    const gl = this.gl;
    // フレームバッファのバインドを解除する
    // 自動的に、既定のフレームバッファがアクティブになり、画面に絵が出るようになる
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.renderProgram);
    // フレームバッファにアタッチされているテクスチャをバインドする
    // トーラスが描画された出来たてほやほやのレンダリング結果が、テクスチャとしてバインドされた状態
    gl.activeTexture(gl.TEXTURE0); // テクスチャユニットは若番から埋めていく
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferObject.texture);
  }

  /**
   * オフスクリーンレンダリングのためのセットアップを行う @@@
   */
  setupOffscreenRendering() {
    const gl = this.gl;
    // フレームバッファをバインドして描画の対象とする
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferObject.framebuffer);
    // ビューポートを設定する（フレームバッファの大きさに合わせてビューポートを設定する）
    gl.viewport(0, 0, App.BUFFER_SIZE, App.BUFFER_SIZE);
    // クリアする色と深度を設定する
    gl.clearColor(1.0, 0.6, 0.9, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.offscreenProgram);
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

    // １フレームの間に２度レンダリングする @@@

    // - オフスクリーンレンダリング -------------------------------------------
    {
      // オフスクリーンレンダリングのセットアップ
      this.setupOffscreenRendering();

      // オフスクリーンシーン用のビュー行列を作る
      const cameraPosition    = Vec3.create(0.0, 0.0, 5.0);
      const cameraCenter      = Vec3.create(0.0, 0.0, 0.0);
      const cameraUpDirection = Vec3.create(0.0, 1.0, 0.0);
      const v = Mat4.lookAt(cameraPosition, cameraCenter, cameraUpDirection);
      // オフスクリーンシーン用のプロジェクション行列を作る
      const fovy   = 45;
      const aspect = 1.0; // フレームバッファは正方形！
      const near   = 0.1
      const far    = 10.0;
      const p = Mat4.perspective(fovy, aspect, near, far);
      // オフスクリーン用のビュー・プロジェクション行列
      const vp = Mat4.multiply(p, v);
      // オフスクリーン用のモデル行列（ここでは回転＋上下移動、適用順序に注意！）
      const vertical = Math.sin(nowTime) * 0.5;
      let m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, vertical, 0.0));
      if (this.isRotation === true) {
        m = Mat4.rotate(m, nowTime, Vec3.create(1.0, 1.0, 0.0));
      }
      // オフスクリーン用の MVP 行列
      const mvp = Mat4.multiply(vp, m);
      // オフスクリーン用の法線変換行列
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));

      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.torusVBO, this.offscreenAttLocation, this.offscreenAttStride, this.torusIBO);
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.offscreenUniLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.offscreenUniLocation.normalMatrix, false, normalMatrix);
      gl.uniform3fv(this.offscreenUniLocation.lightVector, Vec3.create(1.0, 1.0, 1.0));
      // 描画
      gl.drawElements(gl.TRIANGLES, this.torusGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------

    // - 最終シーンのレンダリング ---------------------------------------------
    {
      // レンダリングのセットアップ
      this.setupRendering();

      // 最終シーン用のビュー・プロジェクション行列
      const v = this.camera.update();
      const fovy   = 45;
      const aspect = window.innerWidth / window.innerHeight;
      const near   = 0.1
      const far    = 10.0;
      const p = Mat4.perspective(fovy, aspect, near, far);
      const vp = Mat4.multiply(p, v);
      // 最終シーン用のモデル行列（Y 軸回転）
      const m = Mat4.rotate(Mat4.identity(), nowTime * 0.5, Vec3.create(0.0, 1.0, 0.0));
      // 最終シーン用の MVP 行列
      const mvp = Mat4.multiply(vp, m);

      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.cubeVBO, this.renderAttLocation, this.renderAttStride, this.cubeIBO);
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.renderUniLocation.mvpMatrix, false, mvp);
      gl.uniform1i(this.renderUniLocation.textureUnit, 0);
      // 描画
      gl.drawElements(gl.TRIANGLES, this.cubeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------
  }
}
