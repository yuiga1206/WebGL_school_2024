
// = 001 ======================================================================
// ほぼ最小構成の WebGL 実装サンプルです。
// しつこいくらいにコメントが書いてあるのですが、ここには WebGL の基礎・原則が、
// ぎゅ～っと詰め込まれています。
// 最初はあまりにもやることが多くてびっくりするかもしれませんが、少しずつ慣れて
// いきましょう。一緒に利用している webgl.js のほうも同時に参照しながら、どのよ
// うな流れで WebGL の描画が行われるのか理解していくのがよいでしょう。
// webgl.js 内、WebGLUtility というクラスは原則として静的な（static な）メソッド
// だけを持ったクラスになっており、主に手順が冗長な処理を簡易に呼び出せるように
// することを目的に作ってあります。
// ============================================================================

// モジュールを読み込み
import { WebGLUtility } from '../lib/webgl.js';

// ドキュメントの読み込みが完了したら実行されるようイベントを設定する
window.addEventListener('DOMContentLoaded', async () => {// ★★ three.js のと一緒。
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
  canvas;   // WebGL で描画を行う canvas 要素
  gl;       // WebGLRenderingContext （WebGL コンテキスト）
  program;  // WebGLProgram （プログラムオブジェクト）
  position; // 頂点の座標情報を格納する配列
  stride;   // 頂点の座標を構成する要素の数（ストライド）
  vbo;      // WebGLBuffer （頂点バッファ、Vertex Buffer Object）

  constructor() {
    // this を固定するためのバインド処理
    this.render = this.render.bind(this);// ★★ three.js のと一緒。
  }

  /**
   * 初期化処理を行う
   */
  init() {
    // - WebGL コンテキストを初期化する ---------------------------------------
    // WebGL の様々な命令や設定値は WebGLRenderingContext という正式名称で、HTML
    // の canvas 要素から getContext('webgl') のようにメソッドを呼びだすことで取
    // 得することができます。
    // もし、ここでコンテキストを取得することができなかった場合、その環境上では
    // WebGL を利用することができません。
    // ------------------------------------------------------------------------
    this.canvas = document.getElementById('webgl-canvas');
    this.gl = WebGLUtility.createWebGLContext(this.canvas);// ★★ コンテキストが取れるかどうかのチェックもしてる。

    // - キャンバスの初期サイズ -----------------------------------------------
    // HTML の canvas 要素は、既定での大きさは 300 x 150 ピクセル程度に設定され
    // ているので、これを任意の大きさに変更しておきます。
    // ここでは、学習しやすさを考慮して、ウィンドウのクライアント領域の幅と高さ
    // のうち「短い辺」に縦横の長さを一致させておきます。
    // ※いずれフルスクリーンで実装します
    // ------------------------------------------------------------------------
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
        // - シェーダのロード -------------------------------------------------
        // WebGL では「シェーダ」と呼ばれるプログラムを同時に利用する必要があり、
        // サンプルではシェーダは別ファイルに記述するスタイルを取っています。
        // ここでは、JavaScript の fetch API を利用してこのファイルを開き、中身
        // のソースコードを取り出す処理を行っています。
        // --------------------------------------------------------------------
        // まずシェーダのソースコードを読み込む
        const VSSource = await WebGLUtility.loadFile('./main.vert');
        const FSSource = await WebGLUtility.loadFile('./main.frag');
        // 無事に読み込めたらシェーダオブジェクトの実体を生成する
        const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
        const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);
        // - プログラムオブジェクト -------------------------------------------
        // WebGL では、シェーダのソースコードから「シェーダオブジェクト」を生成
        // しますが、このシェーダオブジェクトをリンクするという作業が必要です。
        // この「リンクを行ったシェーダのプログラム」のことを WebGL では「プログ
        // ラムオブジェクト」と呼びます。
        // 今の段階では、とりあえずプログラムオブジェクトは１つです。
        // 将来的には、複数のプログラムオブジェクトを取り替えながら、複数のシェ
        // ーダプログラムを同時に走らせたりといったことも行います。
        // --------------------------------------------------------------------
        this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);
        // Promise を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // - 頂点属性データ（ジオメトリ） -----------------------------------------
    // 頂点には「座標」や「色」など、複数の「頂点自身が持つ情報」をあらかじめ備
    // えさせておくことができます。
    // どのような情報を頂点に持たせるのかは、なんと自由に実装者が決めることがで
    // きるのですが……普通は、最低でも「座標」を持たせてやらないと、頂点をどこ
    // に描画したらいいのかが決まりません。
    // これらの「頂点にあらかじめ備えさせておく情報」のことを「頂点属性」と呼び
    // ます。
    // ここでは、まずは最低限「頂点座標」の属性を付与するために、まずはそのもと
    // となるデータの定義を行っています。
    // ------------------------------------------------------------------------
    this.position = [// ★★ jsの普通の配列。多重配列はダメ！一次元配列にする。
       0.0,  0.5,  0.0, // ひとつ目の頂点の x, y, z 座標
       0.5, -0.5,  0.0, // ふたつ目の頂点の x, y, z 座標
      -0.5, -0.5,  0.0, // みっつ目の頂点の x, y, z 座標
    ];
    // 要素数は XYZ の３つ
    this.stride = 3;

    // - 頂点バッファ（VBO） --------------------------------------------------
    // WebGL では GPU が描画処理を行います。
    // これはつまり、描画に必要となる情報は「あらかじめ GPU に渡しておく必要があ
    // る」ということでもあります。
    // GPU に情報を渡すには正しく順序よく、手続きを行ってやる必要があります。
    // その手続きのまず最初の段階が「頂点属性情報をバッファに詰め込む作業」です。
    // この頂点属性を詰め込んだバッファは「頂点バッファ」や「VBO」と呼ばれます。
    // （Vertex Buffer Object の頭文字で VBO）
    // ------------------------------------------------------------------------
    this.vbo = WebGLUtility.createVBO(this.gl, this.position);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // - ロケーション ---------------------------------------------------------
    // GPU 上で動作するプログラム（つまりシェーダ）に、正しくデータを渡してやる
    // ために、あらかじめ「ロケーション」と呼ばれる情報を取得しておく必要があり
    // ます。
    // GPU 上の「参照先」や「ポインタのようなもの」と考えるとわかりやすいでしょ
    // うか…… どこに、どの頂点属性のデータを送り込めばいいのかを関連付けしてお
    // く作業です。
    // ロケーションは「シェーダプログラム側の変数名」を指定することで取得するこ
    // とができます。
    // ------------------------------------------------------------------------
    const positionAttributeLocation = gl.getAttribLocation(this.program, 'position');
    // WebGLUtility.enableBuffer は引数を配列で取る仕様なので、いったん配列に入れる
    const vboArray = [this.vbo];// ★★ enableBuffer() には配列として渡すので、配列化する。
    const attributeLocationArray = [positionAttributeLocation];
    const strideArray = [this.stride];// ★★ このアトリビュートが、いくつの要素からなるか
    // ★★ ↑ CPUとGPUは全然違う世界なので、vec3とかstrideとか、ここまでしっかりとした擦り合わせが必要になる。
    WebGLUtility.enableBuffer(gl, vboArray, attributeLocationArray, strideArray);
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // - ビューポート ---------------------------------------------------------
    // WebGL で描画を行う領域のことをビューポートと呼びます。
    // 紛らわしいのは「canvas 要素の大きさ ＝ WebGL のビューポート」ではないとい
    // うことです。
    // どういうことかというと、canvas 要素というのは HTML エレメントの一種なので、
    // 当然ですが CSS で変形させることができます。つまり、canvas の見た目上の大
    // きさは、必ずしもレンダリングする広さと１対１の関係ではないのです。
    // ですから、WebGL 側ではどのような大きさのビューポートを利用したいのか別途
    // 指定しておかなくてはなりません。
    // ------------------------------------------------------------------------
    // ★★ x, y, w, h
    // ★★ WebGLは左下原点なので、原点からの幅と高さ
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色を設定する（RGBA で 0.0 ～ 1.0 の範囲で指定する）
    gl.clearColor(0.3, 0.3, 0.3, 1.0);// ★★ 設定してるだけ。
    // 実際にクリアする（gl.COLOR_BUFFER_BIT で色をクリアしろ、という指定になる）
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // - レンダリング -----------------------------------------------------------
  // 長い長い仕込みを経て、やっとレンダリングです。
  // レンダリングする際は「その時点でバインドされている頂点バッファ」が描画に利
  // 用されます。
  // 普通に考えると「この頂点を描画しろ！」みたいに引数などで指定するのがわかり
  // やすいですが、WebGL の場合は「あくまでもその時バインドされているもの」が描
  // 画の対象になりますので、注意が必要です。
  // gl.drawArrays の第一引数に指定された定数値により、どのようなプリミティブタ
  // イプによって頂点が描かれるのかが変化します。第二引数に指定されたインデック
  // スから、第三引数に指定された個数分、頂点が描画されます。
  // この描画する処理のことを一般に「ドローコール」と呼びます。
  // ドローコールは少なければ少ないほうがよく、パフォーマンスに対する影響が非常
  // に出やすい部分です。（ボトルネックになりやすい）
  // --------------------------------------------------------------------------
  render() {
    const gl = this.gl;
    // プログラムオブジェクトを選択
    gl.useProgram(this.program);
    // ドローコール（描画命令）
    gl.drawArrays(gl.TRIANGLES, 0, this.position.length / this.stride);// ★★ 第三引数は割り算してる
    // ★★ gl.LINES
    // ★★ gl.POINTS
    // ★★ などが使える。他にもある。画像検索がおすすめ。
    // ★★ 基本的には TRIANGLES だけを使った方が良い。考えることが減る。
  }
}
