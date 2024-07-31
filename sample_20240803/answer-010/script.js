
// = 010 ======================================================================
// 課題（フラグメントシェーダでの照明効果）の答え合わせ用実装です。
// * シェーダを２種類用意し、画面を左右に分割し同時に描画する
// * gl.viewport を使うことで２つの空間を同時に描画している（かのように見える）
// * 画面左側に頂点シェーダ処理版を描画
// * 画面右側にフラグメントシェーダ処理版を描画
// * 描画結果の違いを強調するために反射光の実装を追加している
// * ガンマ補正の参考例としてフラグメントシェーダで変換処理を行っている
// ============================================================================

import { WebGLUtility } from '../lib/webgl.js';
import { Vec3, Mat4 } from '../lib/math.js';
import { WebGLGeometry } from '../lib/geometry.js';
import { WebGLOrbitCamera } from '../lib/camera.js';
import { Pane } from '../lib/tweakpane-4.0.3.min.js';

window.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  app.init();
  await app.load();
  app.setupGeometry();
  app.setupLocation();
  app.start();

  // Tweakpane を使った GUI の設定
  const pane = new Pane();
  const parameter = {
    culling: true,
    depthTest: true,
    rotation: false,
  };
  // バックフェイスカリングの有効・無効
  pane.addBinding(parameter, 'culling')
  .on('change', (v) => {
    app.setCulling(v.value);
  });
  // 深度テストの有効・無効
  pane.addBinding(parameter, 'depthTest')
  .on('change', (v) => {
    app.setDepthTest(v.value);
  });
  // 回転の有無
  pane.addBinding(parameter, 'rotation')
  .on('change', (v) => {
    app.setRotation(v.value);
  });
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;                  // WebGL で描画を行う canvas 要素
  gl;                      // WebGLRenderingContext （WebGL コンテキスト）
  program;                 // WebGLProgram （プログラムオブジェクト）
  answerProgram;           // 実装例用 @@@
  attributeLocation;       // attribute 変数のロケーション
  answerAttributeLocation; // 実装例用 @@@
  attributeStride;         // attribute 変数のストライド
  torusGeometry;           // トーラスのジオメトリ情報
  torusVBO;                // トーラスの頂点バッファ
  torusIBO;                // トーラスのインデックスバッファ
  uniformLocation;         // uniform 変数のロケーション
  answerUniformLocation;   // 実装例用 @@@
  startTime;               // レンダリング開始時のタイムスタンプ
  isRendering;             // レンダリングを行うかどうかのフラグ
  isRotation;              // オブジェクトを Y 軸回転させるかどうか
  camera;                  // WebGLOrbitCamera のインスタンス

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
  }

  /**
   * バックフェイスカリングを設定する
   * @param {boolean} flag - 設定する値
   */
  setCulling(flag) {
    const gl = this.gl;
    if (gl == null) {return;}
    if (flag === true) {
      gl.enable(gl.CULL_FACE);
    } else {
      gl.disable(gl.CULL_FACE);
    }
  }

  /**
   * 深度テストを設定する
   * @param {boolean} flag - 設定する値
   */
  setDepthTest(flag) {
    const gl = this.gl;
    if (gl == null) {return;}
    if (flag === true) {
      gl.enable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }
  }

  /**
   * isRotation を設定する
   * @param {boolean} flag - 設定する値
   */
  setRotation(flag) {
    this.isRotation = flag;
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

    // バックフェイスカリングと深度テストは初期状態で有効
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);
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
        // 実装例用のシェーダの初期化処理 @@@
        const answerVSSource = await WebGLUtility.loadFile('./main-answer.vert');
        const answerFSSource = await WebGLUtility.loadFile('./main-answer.frag');
        const answerVertexShader = WebGLUtility.createShaderObject(gl, answerVSSource, gl.VERTEX_SHADER);
        const answerFragmentShader = WebGLUtility.createShaderObject(gl, answerFSSource, gl.FRAGMENT_SHADER);
        this.answerProgram = WebGLUtility.createProgramObject(gl, answerVertexShader, answerFragmentShader);
        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // トーラスのジオメトリ情報を取得
    const row = 256;
    const column = 4;
    const innerRadius = 0.4;
    const outerRadius = 0.8;
    const color = [1.0, 1.0, 1.0, 1.0];
    this.torusGeometry = WebGLGeometry.torus(
      row,
      column,
      innerRadius,
      outerRadius,
      color,
    );

    // VBO と IBO を生成する
    this.torusVBO = [
      WebGLUtility.createVBO(this.gl, this.torusGeometry.position),
      WebGLUtility.createVBO(this.gl, this.torusGeometry.normal),
      WebGLUtility.createVBO(this.gl, this.torusGeometry.color),
    ];
    this.torusIBO = WebGLUtility.createIBO(this.gl, this.torusGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得 @@@
    this.attributeLocation = [
      gl.getAttribLocation(this.program, 'position'),
      gl.getAttribLocation(this.program, 'normal'),
      gl.getAttribLocation(this.program, 'color'),
    ];
    this.answerAttributeLocation = [
      gl.getAttribLocation(this.answerProgram, 'position'),
      gl.getAttribLocation(this.answerProgram, 'normal'),
      gl.getAttribLocation(this.answerProgram, 'color'),
    ];
    // attribute のストライド
    this.attributeStride = [
      3,
      3,
      4,
    ];
    // uniform location の取得 @@@
    this.uniformLocation = {
      mMatrix: gl.getUniformLocation(this.program, 'mMatrix'),
      mvpMatrix: gl.getUniformLocation(this.program, 'mvpMatrix'),
      normalMatrix: gl.getUniformLocation(this.program, 'normalMatrix'),
      eyePosition: gl.getUniformLocation(this.program, 'eyePosition'),
    };
    this.answerUniformLocation = {
      mMatrix: gl.getUniformLocation(this.answerProgram, 'mMatrix'),
      mvpMatrix: gl.getUniformLocation(this.answerProgram, 'mvpMatrix'),
      normalMatrix: gl.getUniformLocation(this.answerProgram, 'normalMatrix'),
      eyePosition: gl.getUniformLocation(this.answerProgram, 'eyePosition'),
    };
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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

    // 幅と高さを求めておく @@@
    const width = this.canvas.width / 2;
    const height = this.canvas.height;

    // モデル座標変換行列（フラグが立っている場合だけ回転させる）
    const rotateAxis = Vec3.create(0.0, 1.0, 0.0);
    const m = this.isRotation === true ?
      Mat4.rotate(Mat4.identity(), nowTime, rotateAxis) :
      Mat4.identity();

    // ビュー・プロジェクション座標変換行列
    const v = this.camera.update();
    const fovy   = 45;
    const aspect = width / height;
    const near   = 0.1
    const far    = 10.0;
    const p = Mat4.perspective(fovy, aspect, near, far);

    // 行列を乗算して MVP 行列を生成する（掛ける順序に注意）
    const vp = Mat4.multiply(p, v);
    const mvp = Mat4.multiply(vp, m);

    // モデル座標変換行列の、逆転置行列を生成する
    const normalMatrix = Mat4.transpose(Mat4.inverse(m));

    // ビューポートを設定する @@@
    gl.viewport(0, 0, width, height);
    // 従来のほうの描画を左側半分に描画
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniformLocation.mMatrix, false, m);
    gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
    gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
    gl.uniform3fv(this.uniformLocation.eyePosition, this.camera.position);
    WebGLUtility.enableBuffer(gl, this.torusVBO, this.attributeLocation, this.attributeStride, this.torusIBO);
    gl.drawElements(gl.TRIANGLES, this.torusGeometry.index.length, gl.UNSIGNED_SHORT, 0);

    // ビューポートを設定する @@@
    gl.viewport(width, 0, width, height);
    // 答え合わせ版のほうの描画を右側半分に描画
    gl.useProgram(this.answerProgram);
    gl.uniformMatrix4fv(this.answerUniformLocation.mMatrix, false, m);
    gl.uniformMatrix4fv(this.answerUniformLocation.mvpMatrix, false, mvp);
    gl.uniformMatrix4fv(this.answerUniformLocation.normalMatrix, false, normalMatrix);
    gl.uniform3fv(this.answerUniformLocation.eyePosition, this.camera.position);
    WebGLUtility.enableBuffer(gl, this.torusVBO, this.answerAttributeLocation, this.attributeStride, this.torusIBO);
    gl.drawElements(gl.TRIANGLES, this.torusGeometry.index.length, gl.UNSIGNED_SHORT, 0);
  }
}

