
// = 006 ======================================================================
// WebGL で 3DCG を描画するとき、魔法のような謎の力で 3D の描画結果が作られるわ
// けではなく、単純に「頂点を 3D に見えるように動かす」ことで、CG は描かれます。
// しかし、3D に見えるように動かすと言っても、より具体的にはいったいどのような処
// 理を行えばよいのでしょうか。
// ここで登場するのが行列です。
// 行列は、大量の頂点を一気に変換するのに適した特性を持っており、WebGL では行列
// の情報を uniform 変数としてシェーダに送ることで、シェーダ内で（つまり GPU で）
// 大量の頂点を一気に変換します。（実際には、頂点シェーダが頂点１つ１つに対して
// 呼び出されることで一律に変換が適用されます）
// three.js の場合は、各種 Object3D 系のオブジェクトが position や rotation など
// のプロパティを持っていて、これが最終的には行列を生成するのに使われます。一方、
// ネイティブな WebGL 実装では当然自前で行列を処理する必要があります。
// 今回から場面が三次元的に描画されるようになりますので、深度値のクリアといった、
// 3D 特有の処理も一部増えています。
// 特に最初のうちは、やることが多く、ひどく複雑に感じられるかもしれません。１つ
// １つ丁寧に、手順を追っていきましょう。
// ============================================================================

// モジュールを読み込み
import { WebGLUtility } from '../lib/webgl.js';
import { Vec3, Mat4 } from '../lib/math.js'; // 算術クラス @@@
import { WebGLGeometry } from '../lib/geometry.js'; // ジオメトリクラス @@@

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
  attributeLocation; // attribute 変数のロケーション @@@
  attributeStride;   // attribute 変数のストライド @@@
  planeGeometry;     // 板ポリゴンのジオメトリ情報 @@@
  planeVBO;          // 板ポリゴンの頂点バッファ @@@
  planeIBO;          // 板ポリゴンのインデックスバッファ @@@
  uniformLocation;   // uniform 変数のロケーション
  startTime;         // レンダリング開始時のタイムスタンプ
  isRendering;       // レンダリングを行うかどうかのフラグ

  constructor() {
    // this を固定するためのバインド処理 @@@
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

    // 最初に一度リサイズ処理を行っておく @@@
    this.resize();

    // リサイズイベントの設定 @@@
    window.addEventListener('resize', this.resize, false);
  }

  /**
   * リサイズ処理 @@@
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
    // uniform location の取得 @@@
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
    // クリアする色と深度を設定する @@@
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする @@@
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

    // - 各種行列を生成する @@@ ------------------------------------------------
    // モデル座標変換行列（平行移動、回転、拡大縮小）
    const rotateAxis = Vec3.create(0.0, 1.0, 0.0);               // Y 軸回転を掛ける
    const m = Mat4.rotate(Mat4.identity(), nowTime, rotateAxis); // 時間の経過が回転量
    // ★★ Mat4.identity() で単位行列を作成。

    // ビュー座標変換行列
    const eye         = Vec3.create(0.0, 0.0, 3.0); // カメラの位置
    const center      = Vec3.create(0.0, 0.0, 0.0); // カメラの注視点
    const upDirection = Vec3.create(0.0, 1.0, 0.0); // カメラの天面の向き（上方向の向き）
    const v = Mat4.lookAt(eye, center, upDirection);

    // プロジェクション座標変換行列
    const fovy   = 45;                                     // 視野角（度数）
    const aspect = window.innerWidth / window.innerHeight; // アスペクト比
    const near   = 0.1;                                    // ニア・クリップ面までの距離
    const far    = 10.0;                                   // ファー・クリップ面までの距離
    const p = Mat4.perspective(fovy, aspect, near, far);

    // 行列を乗算して MVP 行列を生成する（掛ける順序に注意）
    // ※スクールのサンプルは列優先で行列を処理しています
    // ★★ 列優先なので、逆に掛ける。参考：http://matrixmultiplication.xyz/
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
