
// = 016 ======================================================================
// GLSL の reflect を利用することで、法線を使って反射ベクトルを計算することがで
// き、さらにその反射ベクトルとキューブ環境マッピングを利用すると、磨き抜かれた
// 鏡面のような効果が得られました。
// 実はこの反射ベクトルを用いたキューブ環境マッピングは、簡単に屈折マッピングと
// いうちょっと違った実装に変更することができます。
// GLSL のビルトイン関数 reflect と似た名前なのでわかりにくいのですが、屈折ベク
// トルを算出できる関数 refract を利用することでこれを実現できます。
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
  cubeGeometry;      // キューブのジオメトリ情報
  cubeVBO;           // キューブの頂点バッファ
  cubeIBO;           // キューブのインデックスバッファ
  torusGeometry;     // トーラスのジオメトリ情報
  torusVBO;          // トーラスの頂点バッファ
  torusIBO;          // トーラスのインデックスバッファ
  startTime;         // レンダリング開始時のタイムスタンプ
  camera;            // WebGLOrbitCamera のインスタンス
  isRendering;       // レンダリングを行うかどうかのフラグ
  texture;           // テクスチャのインスタンス
  isBackground;      // 背景の描画を行うかどうかのフラグ
  refractiveIndex;   // 屈折率 @@@

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

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // バックフェイスカリングと深度テストは初期状態で有効
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);

    // 初期状態では背景の描画は有効となるように設定する
    this.isBackground = true;

    // 屈折率の初期値 @@@
    this.refractiveIndex = 1.5;
  }

  /**
   * tweakpane の初期化処理
   */
  setupPane() {
    // Tweakpane を使った GUI の設定
    const pane = new Pane();
    const parameter = {
      background: this.isBackground,
      refract: this.refractiveIndex,
    };
    // 背景の描画を行うかどうか
    pane.addBinding(parameter, 'background')
    .on('change', (v) => {
      this.isBackground = v.value;
    });
    // 屈折率 @@@
    pane.addBinding(parameter, 'refract', {
      min: 1.0,
      max: 3.0,
    })
    .on('change', (v) => {
      this.refractiveIndex = v.value;
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
        // キューブマップ用のファイル名配列 @@@
        const sourceArray = [
          './cube_PX.png',
          './cube_PY.png',
          './cube_PZ.png',
          './cube_NX.png',
          './cube_NY.png',
          './cube_NZ.png'
        ];
        // キューブマップ用のターゲット定数配列 @@@
        const targetArray = [
          gl.TEXTURE_CUBE_MAP_POSITIVE_X,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];
        // キューブマップ用画像の読み込み @@@
        this.texture = await WebGLUtility.createCubeTextureFromFile(gl, sourceArray, targetArray);
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

    // cube
    const size = 2.0;
    this.cubeGeometry = WebGLGeometry.cube(size, color);
    this.cubeVBO = [
      WebGLUtility.createVBO(this.gl, this.cubeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.cubeGeometry.normal),
    ];
    this.cubeIBO = WebGLUtility.createIBO(this.gl, this.cubeGeometry.index);

    // torus
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
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得
    this.attributeLocation = [
      gl.getAttribLocation(this.program, 'position'),
      gl.getAttribLocation(this.program, 'normal'),
    ];
    // attribute のストライド
    this.attributeStride = [3, 3];
    // uniform location の取得
    this.uniformLocation = {
      mMatrix: gl.getUniformLocation(this.program, 'mMatrix'),                 // モデル座標変換行列
      mvpMatrix: gl.getUniformLocation(this.program, 'mvpMatrix'),             // MVP 行列
      normalMatrix: gl.getUniformLocation(this.program, 'normalMatrix'),       // 法線変換行列
      refraction: gl.getUniformLocation(this.program, 'refraction'),           // 屈折するかどうか @@@
      refractiveIndex: gl.getUniformLocation(this.program, 'refractiveIndex'), // 屈折率 @@@
      eyePosition: gl.getUniformLocation(this.program, 'eyePosition'),         // 視点の座標
      textureUnit: gl.getUniformLocation(this.program, 'textureUnit'),         // テクスチャユニット
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
  }

  /**
   * 描画を開始する
   */
  start() {
    const gl = this.gl;
    // テクスチャのバインド（キューブマップとしてバインドする）
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
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
    const far = 15.0;
    const p = Mat4.perspective(fovy, aspect, near, far);
    const vp = Mat4.multiply(p, v);

    // プログラムオブジェクトを選択
    gl.useProgram(this.program);

    // 汎用的な uniform 変数は先にまとめて設定しておく
    gl.uniform3fv(this.uniformLocation.eyePosition, this.camera.position);
    gl.uniform1i(this.uniformLocation.textureUnit, 0);
    gl.uniform1f(this.uniformLocation.refractiveIndex, this.refractiveIndex); // 屈折率 @@@

    // まず背景用のキューブを描画する
    if (this.isBackground === true) {
      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.cubeVBO, this.attributeLocation, this.attributeStride, this.cubeIBO);
      // バックフェイスカリングは表面をカリング
      gl.cullFace(gl.FRONT);
      // 深度は書き込まない（背景なので深度テストに干渉させないため）
      gl.depthMask(false);
      // 各種行列を作る
      const m = Mat4.identity();
      const mvp = Mat4.multiply(vp, m);
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));
      // 背景用のキューブからは平行移動成分を消す
      mvp[12] = 0.0;
      mvp[13] = 0.0;
      mvp[14] = 0.0;
      mvp[15] = 1.0;
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.uniformLocation.mMatrix, false, m);
      gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
      gl.uniform1i(this.uniformLocation.refraction, false);
      gl.drawElements(gl.TRIANGLES, this.cubeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }

    // トーラスを描画する
    {
      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.torusVBO, this.attributeLocation, this.attributeStride, this.torusIBO);
      // バックフェイスカリングは裏面をカリング
      gl.cullFace(gl.BACK);
      // 深度は普通に書き込む状態に戻す
      gl.depthMask(true);
      // 各種行列を作る
      const m = Mat4.rotate(Mat4.identity(), nowTime, Vec3.create(1.0, 1.0, 0.0));
      const mvp = Mat4.multiply(vp, m);
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.uniformLocation.mMatrix, false, m);
      gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
      gl.uniform1i(this.uniformLocation.refraction, true);
      gl.drawElements(gl.TRIANGLES, this.torusGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
  }
}
