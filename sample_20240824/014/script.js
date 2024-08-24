
// = 014 ======================================================================
// WebGL に限らず、CG の世界で「鬼門」と呼ばれている非常に難しい問題の１つとして
// ブレンディングがあります。
// 普段、CSS などで opacity を操作して透明度を変更したり、photoshop などのツール
// でアルファ値を扱っていたりすると誤解しやすいのですが、実は透明や半透明を正しく
// 扱うためには、色と色を混ぜ合わせるブレンド処理について深い理解が必要です。
// とはいえ、完全に理解した上で細かい調整をしなければならない場面は通常利用の範
// 囲ではそれほど多くありません。まずは定番の設定内容から覚えていきましょう。
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
  canvas;            // WebGL で描画を行う canvas 要素
  gl;                // WebGLRenderingContext （WebGL コンテキスト）
  program;           // WebGLProgram （プログラムオブジェクト）
  attributeLocation; // attribute 変数のロケーション
  attributeStride;   // attribute 変数のストライド
  uniformLocation;   // uniform 変数のロケーション
  planeGeometry;     // 板ポリゴンのジオメトリ情報
  planeVBO;          // 板ポリゴンの頂点バッファ
  planeIBO;          // 板ポリゴンのインデックスバッファ
  startTime;         // レンダリング開始時のタイムスタンプ
  camera;            // WebGLOrbitCamera のインスタンス
  isRendering;       // レンダリングを行うかどうかのフラグ
  texture;           // テクスチャのインスタンス
  textureVisibility; // テクスチャの可視性
  isBlending;        // ブレンディングを行うかどうかのフラグ @@@
  globalAlpha;       // グローバルなアルファ値 @@@

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
  }

  /**
   * ブレンディングを設定する @@@
   * @param {boolean} flag - 設定する値
   */
  setBlending(flag) {
    const gl = this.gl;
    if (flag === true) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }
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

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // 深度テストは初期状態で有効
    this.gl.enable(this.gl.DEPTH_TEST);
    // this.gl.disable(this.gl.DEPTH_TEST); // ★★ 加算合成なら深度テストを切ると透明が使える。

    // 初期状態ではテクスチャが見えているようにする
    this.textureVisibility = true;

    // 初期状態ではブレンディングは無効化 @@@
    this.isBlending = false;

    // 初期状態ではアルファ値は完全な不透明となるよう設定する @@@
    this.globalAlpha = 1.0;
  }

  /**
   * tweakpane の初期化処理
   */
  setupPane() {
    // Tweakpane を使った GUI の設定
    const pane = new Pane();
    const parameter = {
      texture: this.textureVisibility,
      blending: this.isBlending,
      alpha: this.globalAlpha,
    };
    // テクスチャの表示・非表示
    pane.addBinding(parameter, 'texture')
    .on('change', (v) => {
      this.textureVisibility = v.value;
    });
    // ブレンドを行うかどうか @@@
    pane.addBinding(parameter, 'blending')
    .on('change', (v) => {
      this.isBlending = v.value;
      this.setBlending(v.value);
    });
    // グローバルなアルファ値 @@@
    pane.addBinding(parameter, 'alpha', {
      min: 0.0,
      max: 1.0,
    })
    .on('change', (v) => {
      this.globalAlpha = v.value;
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
        // シェーダのソースコードを読み込みシェーダとプログラムオブジェクトを生成する
        const VSSource = await WebGLUtility.loadFile('./main.vert');
        const FSSource = await WebGLUtility.loadFile('./main.frag');
        const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
        const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);
        this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);
        // 画像を読み込み、テクスチャを初期化する
        const image = await WebGLUtility.loadImage('./sample.jpg');
        this.texture = WebGLUtility.createTexture(gl, image);
        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // プレーンジオメトリの情報を取得
    const size = 2.0;
    const color = [1.0, 1.0, 1.0, 1.0];
    this.planeGeometry = WebGLGeometry.plane(size, size, color);

    // VBO と IBO を生成する
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.normal),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.color),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
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
      gl.getAttribLocation(this.program, 'normal'),
      gl.getAttribLocation(this.program, 'color'),
      gl.getAttribLocation(this.program, 'texCoord'),
    ];
    // attribute のストライド
    this.attributeStride = [
      3,
      3,
      4,
      2,
    ];
    // uniform location の取得
    this.uniformLocation = {
      mvpMatrix: gl.getUniformLocation(this.program, 'mvpMatrix'),
      normalMatrix: gl.getUniformLocation(this.program, 'normalMatrix'),
      textureUnit: gl.getUniformLocation(this.program, 'textureUnit'),
      useTexture: gl.getUniformLocation(this.program, 'useTexture'),
      globalAlpha: gl.getUniformLocation(this.program, 'globalAlpha'), // グローバルアルファ @@@
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

    // ブレンドの設定 @@@
    // ★★ ↓ いわゆるアルファブレンディング。ただし奥から描画すること！
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    // その他の設定例（加算合成＋アルファで透明）
    // gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    // ★★ ↑　深度テストを切れば、加算合成は裏から見ても透明が破綻していない。
    // ★★ 奥が光っている、ネオンのようなものとかには使えるテクニック。
  }

  /**
   * 描画を開始する
   */
  start() {
    const gl = this.gl;
    // 途中でテクスチャを切り替えないためここでバインドしておく
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
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

    // ビュー・プロジェクション座標変換行列
    const v = this.camera.update();
    const fovy = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1
    const far = 10.0;
    const p = Mat4.perspective(fovy, aspect, near, far);
    const vp = Mat4.multiply(p, v);

    // VBO と IBO を設定
    WebGLUtility.enableBuffer(gl, this.planeVBO, this.attributeLocation, this.attributeStride, this.planeIBO);

    // プログラムオブジェクトを選択
    gl.useProgram(this.program);

    // 汎用的な uniform 変数は先にまとめて設定しておく
    gl.uniform1i(this.uniformLocation.textureUnit, 0);
    gl.uniform1i(this.uniformLocation.useTexture, this.textureVisibility);
    gl.uniform1f(this.uniformLocation.globalAlpha, this.globalAlpha); // グローバルアルファ @@@

    // １つ目のポリゴンを描画する @@@
    {
      // モデル座標変換行列（１つ目は奥）
      const m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, 0.0, -0.5));
      const mvp = Mat4.multiply(vp, m);
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));
      gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
      gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }

    // ２つ目のポリゴンを描画する @@@
    {
      // モデル座標変換行列（２つ目は手前）
      const m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, 0.0, 0.5));
      const mvp = Mat4.multiply(vp, m);
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));
      gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
      gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
  }
}
