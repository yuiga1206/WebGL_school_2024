
// = 003 ======================================================================
// WebGL で利用するシェーダには３つの修飾子があり、既に登場している attribute と
// varying の他に、uniform 変数と呼ばれる固有の役割を持つ変数タイプがあります。
// これまでに登場した attribute 変数が「あらかじめ VBO（頂点属性）にしておく必要
// があった」のに対し、ここで登場する uniform 変数は、あらかじめバッファにデータ
// を詰めておく必要はありません。
// 任意のタイミングで、自由に、汎用的に、CPU 側の実装（JavaScript）からシェーダ
// に対してデータを送ることができます。
// ただし、データを送る手順（利用するメソッド）などがやや難しいので、少しずつ慣
// れていきましょう。
// ============================================================================

// モジュールを読み込み
import { WebGLUtility } from '../lib/webgl.js';

// ドキュメントの読み込みが完了したら実行されるようイベントを設定する
window.addEventListener('DOMContentLoaded', async () => {
  // アプリケーションのインスタンスを初期化し、必要なリソースをロードする
  const app = new App();
  app.init();
  await app.load();
  // ロードが終わったら各種セットアップを行う
  app.setupGeometry();
  app.setupLocation();
  // すべてのセットアップが完了したら描画を開始する @@@
  app.start();
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;          // WebGL で描画を行う canvas 要素
  gl;              // WebGLRenderingContext （WebGL コンテキスト）
  program;         // WebGLProgram （プログラムオブジェクト）
  position;        // 頂点の座標情報を格納する配列
  positionStride;  // 頂点の座標のストライド
  positionVBO;     // 頂点座標の VBO
  color;           // 頂点カラーの座標情報を格納する配列
  colorStride;     // 頂点カラーの座標のストライド
  colorVBO;        // 頂点カラー座標の VBO
  uniformLocation; // uniform 変数のロケーション @@@
  startTime;       // レンダリング開始時のタイムスタンプ @@@
  isRendering;     // レンダリングを行うかどうかのフラグ @@@

  constructor() {
    // this を固定するためのバインド処理
    this.render = this.render.bind(this);
  }

  /**
   * 初期化処理を行う
   */
  init() {
    // canvas エレメントの取得と WebGL コンテキストの初期化
    this.canvas = document.getElementById('webgl-canvas');
    this.gl = WebGLUtility.createWebGLContext(this.canvas);

    // canvas のサイズを設定
    const size = Math.min(window.innerWidth, window.innerHeight);
    this.canvas.width  = size;
    this.canvas.height = size;
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      // 変数に WebGL コンテキストを代入しておく（コード記述の最適化）
      const gl = this.gl;
      // WebGL コンテキストがあるかどうか確認する
      if (gl == null) {
        // もし WebGL コンテキストがない場合はエラーとして Promise を reject する
        const error = new Error('not initialized');
        reject(error);
      } else {
        // まずシェーダのソースコードを読み込む
        const VSSource = await WebGLUtility.loadFile('./main.vert');
        const FSSource = await WebGLUtility.loadFile('./main.frag');
        // 無事に読み込めたらシェーダオブジェクトの実体を生成する
        const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
        const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);
        // プログラムオブジェクトを生成する
        this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // 頂点座標の定義
    this.position = [
       0.0,  0.5,  0.0, // ひとつ目の頂点の x, y, z 座標
       0.5, -0.5,  0.0, // ふたつ目の頂点の x, y, z 座標
      -0.5, -0.5,  0.0, // みっつ目の頂点の x, y, z 座標
    ];
    // 要素数は XYZ の３つ
    this.positionStride = 3;
    // VBO を生成
    this.positionVBO = WebGLUtility.createVBO(this.gl, this.position);

    // 頂点の色の定義
    this.color = [
      1.0, 0.0, 0.0, 1.0, // ひとつ目の頂点の r, g, b, a カラー
      0.0, 1.0, 0.0, 1.0, // ふたつ目の頂点の r, g, b, a カラー
      0.0, 0.0, 1.0, 1.0, // みっつ目の頂点の r, g, b, a カラー
    ];
    // 要素数は RGBA の４つ
    this.colorStride = 4;
    // VBO を生成
    this.colorVBO = WebGLUtility.createVBO(this.gl, this.color);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得
    const positionAttributeLocation = gl.getAttribLocation(this.program, 'position');
    const colorAttributeLocation = gl.getAttribLocation(this.program, 'color');
    // WebGLUtility.enableBuffer は引数を配列で取る仕様なので、いったん配列に入れる
    const vboArray = [this.positionVBO, this.colorVBO];
    const attributeLocationArray = [positionAttributeLocation, colorAttributeLocation];
    const strideArray = [this.positionStride, this.colorStride];
    // 頂点情報の有効化
    WebGLUtility.enableBuffer(gl, vboArray, attributeLocationArray, strideArray);

    // uniform location の取得 @@@
    // ★★ 後々、使いやすいようにjsオブジェクトにしているが、必須では無い。
    this.uniformLocation = {
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
    // クリアする色を設定する（RGBA で 0.0 ～ 1.0 の範囲で指定する）
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    // 実際にクリアする（gl.COLOR_BUFFER_BIT で色をクリアしろ、という指定になる）
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * 描画を開始する @@@
   */
  start() {
    // レンダリング開始時のタイムスタンプを取得しておく @@@
    this.startTime = Date.now();

    // レンダリングを行っているフラグを立てておく @@@
    this.isRendering = true;

    // レンダリングの開始
    this.render();
  }

  /**
   * 描画を停止する @@@
   */
  stop() {
    this.isRendering = false;
  }

  /**
   * レンダリングを行う
   */
  render() {
    const gl = this.gl;

    // レンダリングのフラグの状態を見て、requestAnimationFrame を呼ぶか決める @@@
    if (this.isRendering === true) {
      requestAnimationFrame(this.render);
    }

    // ビューポートの設定やクリア処理は毎フレーム呼び出す @@@
    this.setupRendering();// ★★ クリアして次の描画……

    // 現在までの経過時間を計算し、秒単位に変換する @@@
    // ★★ Date.now() の戻り値はミリ秒なので、1/1000すると秒単位になる
    const nowTime = (Date.now() - this.startTime) * 0.001;

    // プログラムオブジェクトを選択
    gl.useProgram(this.program);

    // - uniform 変数は種類応じてメソッドが変化 -------------------------------
    // シェーダプログラム（つまり GLSL）側で uniform 変数がどのように定義されて
    // いるのかによって、CPU 側から値を送る際は適切にメソッドを呼び分けないとい
    // けません。
    // 残念ながら、これは暗記するというかメソッド名のルールを覚えるしかないので、
    // 最初はちょっと難しいかもしれません。
    // 基本的なルールは「要素数＋データ型＋配列かどうか」という３つの要因によっ
    // て決まります。たとえば uniform1fv なら「１つの、float の、配列」です。
    // ※配列の部分はより正確にはベクトルで、v で表されます
    // 以下に、いくつかの例を記載しますがこれで全種類ではありません。まずは代表
    // 的なところだけでいいのでやんわり憶えておきましょう。
    //
    // メソッド名       : 中身のデータ                       : GLSL での意味
    // -----------------:------------------------------------:--------------
    // uniform1i        : １つの整数                         : int
    // uniform1f        : １つの浮動小数点                   : float
    // uniform1fv       : １つの浮動小数点を配列に入れたもの : float[n]
    // uniform2fv       : ２つの浮動小数点を配列にいれたもの : vec2
    // uniform3fv       : ３つの浮動小数点を配列にいれたもの : vec3
    // uniform4fv       : ４つの浮動小数点を配列にいれたもの : vec4
    // uniformMatrix2fv : 配列で表現された 2x2 の行列        : mat2
    // uniformMatrix3fv : 配列で表現された 3x3 の行列        : mat3
    // uniformMatrix4fv : 配列で表現された 4x4 の行列        : mat4
    //
    // ※ここに記載されているものが全てではありません
    // --------------------------------------------------------------------

    // ロケーションを指定して、uniform 変数の値を更新する（GPU に送る） @@@
    gl.uniform1f(this.uniformLocation.time, nowTime);
    // ★★ vec2を送りたければ…　→　gl.uniform2fv(this.uniformLocation.time, [nowTime, 0.01]);

    // ドローコール（描画命令）
    gl.drawArrays(gl.TRIANGLES, 0, this.position.length / this.positionStride);
  }
}
