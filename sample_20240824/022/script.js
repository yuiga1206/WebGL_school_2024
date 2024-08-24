
// = 022 ======================================================================
// フレームバッファを活用すると、一度レンダリングしたシーンに対してブラー（つま
// りボカシ）を掛けることができます。
// 一般に、ボカシは非常にコストの高いポストエフェクトなので、様々な軽量化の手法
// が研究されていますが、ここでは「縦と横を別々にぼかすことで軽量化する」という
// テクニックを使っています。
// フレームバッファが２つ必要になることや、頻繁に行われるバインド・アンバインド
// がどうしても難しく感じるかと思いますが、落ち着いて手順を確認していきましょう。
// 順番としては、１．オフスクリーンレンダリング → ２．横方向ブラー → ３．縦方
// 向ブラー（この描画結果が画面に出る）、となります。ブラーを横と縦に分離するこ
// とによって負荷を大きく軽減しています。（それでもポストエフェクトとして重い処
// 理に分類されるので用法には注意）
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
  planeGeometry;        // 板ポリゴンのジオメトリ情報
  planeVBO;             // 板ポリゴンの頂点バッファ
  planeIBO;             // 板ポリゴンのインデックスバッファ
  sphereGeometry;       // 球体のジオメトリ情報
  sphereVBO;            // 球体の頂点バッファ
  sphereIBO;            // 球体のインデックスバッファ
  startTime;            // レンダリング開始時のタイムスタンプ
  camera;               // WebGLOrbitCamera のインスタンス
  isRendering;          // レンダリングを行うかどうかのフラグ
  framebufferArray;     // フレームバッファ用の配列 @@@
  texture;              // 画像を割り当てるテクスチャ
  gaussStrength;        // ガウシアンブラーの強さ @@@
  gaussWeight;          // ガウス係数の配列 @@@

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

    // 最初に一度リサイズ処理を行っておく（ここで結果的にフレームバッファが生成される）
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // バックフェイスカリングと深度テストは初期状態で有効
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);

    // 初期状態としてのガウシアンブラーの強度を設定する @@@
    this.gaussStrength = 100.0;
    // ひとまず配列をセットしておく @@@
    this.gaussWeight = [];
    // ガウス係数を最初に一度求めておく @@@
    this.calcGaussWeight(this.gaussStrength);
  }

  /**
   * tweakpane の初期化処理
   */
  setupPane() {
    // Tweakpane を使った GUI の設定
    const pane = new Pane();
    const parameter = {
      weight: this.gaussStrength,
    };
    // ブラーの強さ @@@
    pane.addBinding(parameter, 'weight', {
      min: 1.0,
      max: 200.0,
    })
    .on('change', (v) => {
      this.calcGaussWeight(v.value);
    });
  }

  /**
   * リサイズ処理
   */
  resize() {
    const gl = this.gl;

    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.framebufferArray == null) {
      // まだ生成されていない場合は、生成する
      this.framebufferArray = [
        WebGLUtility.createFramebuffer(gl, this.canvas.width, this.canvas.height),
        WebGLUtility.createFramebuffer(gl, this.canvas.width, this.canvas.height),
      ];
    } else {
      // 生成済みのフレームバッファもキャンバスにサイズを合わせる
      this.framebufferArray.forEach((buffer) => {
        WebGLUtility.resizeFramebuffer(
          this.gl,
          this.canvas.width,
          this.canvas.height,
          buffer.depthRenderbuffer,
          buffer.texture,
        );
      });
    }
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      const gl = this.gl;
      if (gl == null) {
        const error = new Error('not initialized');
        reject(error);
      } else {
        // 最終シーンレンダリング用のシェーダ @@@
        const renderVSSource = await WebGLUtility.loadFile('./render.vert')
        const renderFSSource = await WebGLUtility.loadFile('./render.frag')
        const renderVertexShader = WebGLUtility.createShaderObject(gl, renderVSSource, gl.VERTEX_SHADER);
        const renderFragmentShader = WebGLUtility.createShaderObject(gl, renderFSSource, gl.FRAGMENT_SHADER);
        this.renderProgram = WebGLUtility.createProgramObject(gl, renderVertexShader, renderFragmentShader);
        // オフスクリーンレンダリング用のシェーダ @@@
        const offscreenVSSource = await WebGLUtility.loadFile('./offscreen.vert')
        const offscreenFSSource = await WebGLUtility.loadFile('./offscreen.frag')
        const offscreenVertexShader = WebGLUtility.createShaderObject(gl, offscreenVSSource, gl.VERTEX_SHADER);
        const offscreenFragmentShader = WebGLUtility.createShaderObject(gl, offscreenFSSource, gl.FRAGMENT_SHADER);
        this.offscreenProgram = WebGLUtility.createProgramObject(gl, offscreenVertexShader, offscreenFragmentShader);
        // テクスチャのロード
        const image = await WebGLUtility.loadImage('./sample.jpg');
        this.texture = WebGLUtility.createTexture(gl, image);
        // Promise を解決
        resolve();
      }
    });
  }

  /**
   * ガウス係数を算出する @@@
   * @param {number} strength - ブラーの強さ
   */
  calcGaussWeight(strength) {
    // この変数 RESOLUTION がシェーダのなかでループする回数と同じになるようにする
    const RESOLUTION = 20;

    // ガウス係数を算出
    const weight = [];
    let total = 0.0;
    for (let i = 0; i < RESOLUTION; ++i) {
      const r = 1.0 + 2.0 * i;
      let c = Math.exp(-0.5 * (r * r) / strength);
      weight[i] = c;
      if (i > 0) {
        c *= 2.0;
      }
      total += c;
    }

    // ガウシアンブラーの強さ
    this.gaussStrength = strength;

    // ウェイト総量で割って正規化したものを使う
    this.gaussWeight = weight.map((v) => {
      return v / total;
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    const color = [1.0, 1.0, 1.0, 1.0];

    // plane は this.renderProgram と一緒に使う
    const size = 2.0;
    this.planeGeometry = WebGLGeometry.plane(size, size, color);
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
    ];
    this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);

    // sphere は this.offscreenProgram と一緒に使う
    const segment = 64;
    const radius = 1.0;
    this.sphereGeometry = WebGLGeometry.sphere(segment, segment, radius, color);
    this.sphereVBO = [
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.position),
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.normal),
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.texCoord),
    ];
    this.sphereIBO = WebGLUtility.createIBO(this.gl, this.sphereGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // 最終シーンレンダリング用のセットアップ
    this.renderAttLocation = [
      gl.getAttribLocation(this.renderProgram, 'position'),
      gl.getAttribLocation(this.renderProgram, 'texCoord'),
    ];
    this.renderAttStride = [3, 2];
    this.renderUniLocation = {
      textureUnit: gl.getUniformLocation(this.renderProgram, 'textureUnit'), // テクスチャユニット
      resolution: gl.getUniformLocation(this.renderProgram, 'resolution'),   // 解像度
      horizontal: gl.getUniformLocation(this.renderProgram, 'horizontal'),   // 水平に処理するかどうか @@@
      weight: gl.getUniformLocation(this.renderProgram, 'weight'),           // ガウス係数の配列 @@@
    };

    // オフスクリーン用のセットアップ
    this.offscreenAttLocation = [
      gl.getAttribLocation(this.offscreenProgram, 'position'),
      gl.getAttribLocation(this.offscreenProgram, 'normal'),
      gl.getAttribLocation(this.offscreenProgram, 'texCoord'),
    ];
    this.offscreenAttStride = [3, 3, 2];
    this.offscreenUniLocation = {
      mvpMatrix: gl.getUniformLocation(this.offscreenProgram, 'mvpMatrix'),       // MVP 行列
      normalMatrix: gl.getUniformLocation(this.offscreenProgram, 'normalMatrix'), // 法線変換用行列
      lightVector: gl.getUniformLocation(this.offscreenProgram, 'lightVector'),   // ライトベクトル
      textureUnit: gl.getUniformLocation(this.offscreenProgram, 'textureUnit'),   // テクスチャユニット
    };
  }

  /**
   * 一番最初のオフスクリーンレンダリングのためのセットアップを行う @@@
   * ※まず最初にフレームバッファ[0] に普通にシーンをレンダリングする
   */
  setupFirstOffscreenRendering() {
    const gl = this.gl;
    // ０番目のフレームバッファをバインドして描画の対象とする
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferArray[0].framebuffer);
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(1.0, 0.6, 0.9, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.offscreenProgram);
    // スフィアに貼るテクスチャをバインドする
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  /**
   * 二番目のオフスクリーンレンダリングのためのセットアップを行う @@@
   * ※フレームバッファ[1] に対して横方向ブラーを掛けた結果をレンダリングする
   */
  setupSecondOffscreenRendering() {
    const gl = this.gl;
    // １番目のフレームバッファをバインドして描画の対象とする
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferArray[1].framebuffer);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.renderProgram);
    // setupFirstOffscreenRendering で描画した結果をバインドする
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferArray[0].texture);
  }

  /**
   * 最終レンダリングのためのセットアップを行う @@@
   */
  setupFinalRendering() {
    const gl = this.gl;
    // フレームバッファのバインドを解除する
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // setupSecondOffscreenRendering で描画した結果をバインドする
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferArray[1].texture);
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

    // - 一番最初のオフスクリーンレンダリング ---------------------------------
    {
      // レンダリングのセットアップ
      this.setupFirstOffscreenRendering();

      // オフスクリーンシーン用のビュー行列を作る
      const v = this.camera.update();
      // オフスクリーンシーン用のプロジェクション行列を作る
      const fovy = 45;
      const aspect = window.innerWidth / window.innerHeight;
      const near = 0.1
      const far = 10.0;
      const p = Mat4.perspective(fovy, aspect, near, far);
      // オフスクリーン用のビュー・プロジェクション行列
      const vp = Mat4.multiply(p, v);
      // オフスクリーン用のモデル行列（ここでは回転＋上下移動、適用順序に注意！）
      const vertical = Math.sin(nowTime) * 0.5;
      const m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, vertical, 0.0));
      // オフスクリーン用の MVP 行列
      const mvp = Mat4.multiply(vp, m);
      // オフスクリーン用の法線変換行列
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));

      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.sphereVBO, this.offscreenAttLocation, this.offscreenAttStride, this.sphereIBO);
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.offscreenUniLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.offscreenUniLocation.normalMatrix, false, normalMatrix);
      gl.uniform3fv(this.offscreenUniLocation.lightVector, Vec3.create(1.0, 1.0, 1.0));
      gl.uniform1i(this.offscreenUniLocation.textureUnit, 0);
      // 描画
      gl.drawElements(gl.TRIANGLES, this.sphereGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------

    // - 二番目のオフスクリーンレンダリング -----------------------------------
    {
      // レンダリングのセットアップ
      this.setupSecondOffscreenRendering();

      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.planeVBO, this.renderAttLocation, this.renderAttStride, this.planeIBO);
      // シェーダに各種パラメータを送る
      gl.uniform1i(this.renderUniLocation.textureUnit, 0);
      gl.uniform2fv(this.renderUniLocation.resolution, [this.canvas.width, this.canvas.height]);
      gl.uniform1i(this.renderUniLocation.horizontal, true); // 水平に処理するかどうか
      gl.uniform1fv(this.renderUniLocation.weight, this.gaussWeight); // ガウス係数の配列
      // 描画
      gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------

    // - 最終シーンのレンダリング ---------------------------------------------
    {
      // レンダリングのセットアップ
      this.setupFinalRendering();

      // シェーダに各種パラメータを送る
      gl.uniform1i(this.renderUniLocation.horizontal, false); // 水平に処理するかどうか
      // 描画
      gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------
  }
}
