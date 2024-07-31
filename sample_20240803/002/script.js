
// = 002 ======================================================================
// WebGL API を駆使する JavaScript の実装だけでなく、GLSL と呼ばれる「シェーダ記
// 述言語」を用いた「シェーダ」を同時に使うのが、WebGL のやや難しい部分です。
// ここでは、シェーダとの連携をイメージしやすくする、また単純に慣れるという意味
// も含めて「頂点に色の属性を持たせる」ということをやってみます。
// このような実装を行うと、頂点それぞれが、個々に「頂点自身の色」を持つことがで
// きるようになります。
// 描画結果は頂点カラーが自動的にグラデーションして表現されます。また、シェーダ
// のソースコードにも変更が加えられているので確認してみましょう。
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
  app.setupRendering();
  // すべてのセットアップが完了したら描画を行う
  app.render();
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;         // WebGL で描画を行う canvas 要素
  gl;             // WebGLRenderingContext （WebGL コンテキスト）
  program;        // WebGLProgram （プログラムオブジェクト）
  position;       // 頂点の座標情報を格納する配列
  positionStride; // 頂点の座標のストライド
  positionVBO;    // 頂点座標の VBO
  color;          // 頂点カラーの座標情報を格納する配列 @@@
  colorStride;    // 頂点カラーの座標のストライド @@@
  colorVBO;       // 頂点カラー座標の VBO @@@

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

    // 頂点の色の定義 @@@
    this.color = [
      1.0, 0.0, 0.0, 1.0, // ひとつ目の頂点の r, g, b, a カラー
      0.0, 1.0, 0.0, 1.0, // ふたつ目の頂点の r, g, b, a カラー
      0.0, 0.0, 1.0, 1.0, // みっつ目の頂点の r, g, b, a カラー
    ];
    // 要素数は RGBA の４つ
    this.colorStride = 4;
    // VBO を生成
    this.colorVBO = WebGLUtility.createVBO(this.gl, this.color);

    // - 頂点属性は必ず同じ頂点の個数分定義する -------------------------------
    // 今回のサンプルでは頂点に対して「座標」の他に「色」を加えようとしています。
    // ジオメトリに対して新しく頂点属性を加える（今回であれば新要素は色）場合は、
    // 頂点の個数が一致するように正しく配列の長さを調整します。
    // ※position が４つ分なら、color も４つ分定義するということ
    // これは最終的にシェーダ内で頂点が処理されるとき、常にすべての頂点が同じ属
    // 性を持っている必要があるためです。（一部の頂点には色があるが、一部には無
    // い、のような状態にしたければジオメトリとシェーダを別にするしかない）
    // ------------------------------------------------------------------------
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得 @@@
    const positionAttributeLocation = gl.getAttribLocation(this.program, 'position');
    const colorAttributeLocation = gl.getAttribLocation(this.program, 'color');
    // WebGLUtility.enableBuffer は引数を配列で取る仕様なので、いったん配列に入れる
    const vboArray = [this.positionVBO, this.colorVBO];
    const attributeLocationArray = [positionAttributeLocation, colorAttributeLocation];
    const strideArray = [this.positionStride, this.colorStride];
    // 頂点情報の有効化
    WebGLUtility.enableBuffer(gl, vboArray, attributeLocationArray, strideArray);
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
   * レンダリングを行う
   */
  render() {
    const gl = this.gl;
    // プログラムオブジェクトを選択
    gl.useProgram(this.program);
    // ドローコール（描画命令）
    gl.drawArrays(gl.TRIANGLES, 0, this.position.length / this.positionStride);
  }
}
