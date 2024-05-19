
// = 課題： ======================================================================
// ■ Box Geometry を利用すること
// ■ ボックスが画面上に100個以上描かれるようにすること
// ■ まっすぐ並べてもいいし......ランダムでもいい(配置の仕方は自由)
// ■ 色や大きさなどは自由
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  app.render();
}, false);

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    // fovy は Field of View Y のことで、縦方向の視野角を意味する
    fovy: 60,
    // 描画する空間のアスペクト比（縦横比）
    aspect: window.innerWidth / window.innerHeight,
    // 描画する空間のニアクリップ面（最近面）
    near: 0.1,
    // 描画する空間のファークリップ面（最遠面）
    far: 50.0,
    // カメラの座標
    position: new THREE.Vector3(0.0, 2.0, 30.0),
    // カメラの注視点
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x666666,       // 画面をクリアする色
    width: window.innerWidth,   // レンダラーに設定する幅
    height: window.innerHeight, // レンダラーに設定する高さ
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,                            // 光の色
    intensity: 1.0,                             // 光の強度
    position: new THREE.Vector3(1.0, 1.0, 1.0), // 光の向き
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff, // 光の色
    intensity: 0.1,  // 光の強度
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM_01 = {
    color: 0x212121, // 黒
  };
  static MATERIAL_PARAM_02 = {
    color: 0x313151, // 濃紺
  };
  static MATERIAL_PARAM_03 = {
    color: 0xD1D9D9, // グレー
  };
  static MATERIAL_PARAM_04 = {
    color: 0x5939A9, // 首元のブルー
  };
  static MATERIAL_PARAM_05 = {
    color: 0x514951, // 濃いグレー
  };
  static MATERIAL_PARAM_06 = {
    color: 0x8971D9, // むらさき
  };
  static MATERIAL_PARAM_07 = {
    color: 0x194999, // 額当てのブルー
  };
  static MATERIAL_PARAM_08 = {
    color: 0xE9B921, // きいろ
  };
  static MATERIAL_PARAM_09 = {
    color: 0x612121, // ちゃいろ
  };
  static MATERIAL_PARAM_10 = {
    color: 0xE9A999, // 肌色
  };
  static MATERIAL_PARAM_11 = {
    color: 0xD16101, // オレンジ
  };
  static MATERIAL_PARAM_12 = {
    color: 0xB97959, // 薄い茶色
  };
  static MATERIAL_PARAM_13 = {
    color: 0x2179D9, // ブルー
  };


  renderer;         // レンダラ
  scene;            // シーン
  camera;           // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight;     // 環境光（アンビエントライト）
  material;         // マテリアル
  // torusGeometry;    // トーラスジオメトリ
  // torusArray;       // トーラスメッシュの配列 @@@
  boxGeometry;      // ボックスジオメトリ
  characterArray01;       // ボックスメッシュの配列
  characterArray02;       // ボックスメッシュの配列
  controls;         // オービットコントロール
  axesHelper;       // 軸ヘルパー
  isDown;           // キーの押下状態用フラグ

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far,
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // マテリアル
    this.material_01 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_01);// 黒
    this.material_02 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_02);// 濃紺
    this.material_03 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_03);// グレー
    this.material_04 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_04);// 首元のブルー
    this.material_05 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_05);// 濃いグレー
    this.material_06 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_06);// むらさき
    this.material_07 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_07);// 額当てのブルー
    this.material_08 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_08);// きいろ
    this.material_09 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_09);// ちゃいろ
    this.material_10 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_10);// 肌色
    this.material_11 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_11);// オレンジ
    this.material_12 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_12);// 薄い茶色
    this.material_13 = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM_13);// ブルー

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する @@@
    // const torusCount = 100;
    // const transformScale = 5.0;
    // this.torusGeometry = new THREE.TorusGeometry(0.5, 0.2, 8, 16);// ★★ ループの外に書くこと！使い回すので1度の記述で良いので、ループの中に書かない。
    // this.torusArray = [];
    // for (let i = 0; i < torusCount; ++i) {
    //   // トーラスメッシュのインスタンスを生成
    //   const torus = new THREE.Mesh(this.torusGeometry, this.material);
    //   // 座標をランダムに散らす
    //   torus.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
    //   torus.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
    //   torus.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
    //   // シーンに追加する
    //   this.scene.add(torus);
    //   // 配列に入れておく
    //   this.torusArray.push(torus);
    // }
    const boxCount_01 = 308;
    const boxCount_02 = 308;
    // const transformScale = 5.0;
    this.boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    this.characterArray01 = [];
    this.characterArray02 = [];
    for (let i = 0; i < boxCount_01; ++i) {
      // トーラスメッシュのインスタンスを生成
      // const box = new THREE.Mesh(this.boxGeometry, this.material_01);
      // 座標をランダムに散らす
      // character01.position.x = (Math.random() * 2.0 - 1.0) * transformScale;
      // character01.position.y = (Math.random() * 2.0 - 1.0) * transformScale;
      // character01.position.z = (Math.random() * 2.0 - 1.0) * transformScale;
      // character01.position.x = i + 1;
      let character01;

      // 色の指定
      switch (i) {
        // 黒：212121
        case 0: case 5: case 6: case 13: case 14: case 15: case 16: case 27: case 28: case 40: case 43: case 45: case 54: case 58: case 59: case 69: case 73: case 74: case 85: case 89: case 90: case 101: case 105: case 106: case 117: case 121: case 134: case 137: case 151: case 152: case 155: case 166: case 169: case 178: case 182: case 191: case 198: case 201: case 220: case 223: case 235: case 247: case 249: case 253: case 255: case 261: case 262: case 263: case 264: case 267: case 268: case 269: case 272: case 273: case 276: case 277: case 281: case 282: case 283: case 286: case 287: case 288: case 290: case 293: case 294: case 295: case 296: case 297: case 298: case 299: case 300: case 302: case 303: case 304: case 305: case 306: case 307:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_01);
          break;
        // 濃紺：313151
        case 22: case 26: case 29: case 44: case 46: case 47: case 63: case 112: case 113: case 122: case 127: case 132: case 135: case 138: case 141: case 142: case 149: case 153: case 165: case 167: case 179: case 181: case 192: case 206: case 221: case 224: case 233: case 236: case 241: case 246: case 250: case 265: case 278: case 291: case 301:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_02);
          break;
        // グレー：D1D9D9
        case 9: case 10: case 18: case 19: case 81: case 82: case 91: case 102: case 107: case 118: case 129: case 154: case 168: case 174: case 180: case 193: case 207: case 209: case 210: case 222: case 225: case 226: case 227: case 237: case 242: case 245: case 251: case 257: case 258: case 266: case 279: case 292:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_03);
          break;
        // 首元のブルー：5939A9
        case 144: case 147: case 156: case 158: case 163: case 170: case 171:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_04);
          break;
        // 濃いグレー：514951
        case 239: case 248: case 254: case 259: case 270: case 274: case 284: case 289:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_05);
          break;
        // むらさき：8971D9
        case 128: case 130: case 131: case 139: case 143: case 148: case 157: case 164: case 234: case 238: case 240: case 252: case 256: case 260: case 271: case 275: case 280: case 285:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_06);
          break;
        // 額当てのブルー：194999
        case 30: case 35: case 36: case 37: case 51: case 67: case 68: case 95: case 97: case 98: case 110: case 126: case 228: case 229: case 243: case 244:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_07);
          break;
        // きいろ：E9B921
        case 11: case 17: case 20: case 32: case 33: case 60: case 75: case 76: case 93: case 108: case 109: case 217: case 218: case 230: case 231: case 232:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_08);
          break;
        // ちゃいろ：612121
        case 4: case 12: case 42: case 61: case 71: case 77: case 87: case 92: case 94: case 103: case 123: case 136: case 140: case 145: case 146: case 185: case 188: case 194: case 196: case 203: case 205: case 208: case 211: case 213: case 216: case 219:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_09);
          break;
        // 肌色：E9A999
        case 41: case 55: case 62: case 70: case 78: case 84: case 86: case 99: case 100: case 114: case 115: case 119: case 159: case 160: case 161: case 162: case 172: case 173: case 175: case 176: case 177: case 184: case 186: case 187: case 189: case 197: case 199: case 200: case 202: case 212: case 214: case 215:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_10);
          break;
        // オレンジ：D16101
        case 1: case 2: case 3: case 7: case 8: case 21: case 23: case 24: case 25: case 31: case 34: case 124: case 125: case 195: case 204:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_11);
          break;
        // 薄い茶色：B97959
        case 56: case 57: case 72: case 79: case 80: case 83: case 88: case 104: case 120: case 183: case 190:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_12);
          break;
        // ブルー：2179D9
        case 38: case 39: case 48: case 49: case 50: case 52: case 53: case 64: case 65: case 66: case 96: case 111: case 116: case 133: case 150:
          character01 = new THREE.Mesh(this.boxGeometry, this.material_13);
          break;
        default:
          break;
      }
      // y軸の指定（12px目をセンターにする：-11 ~ 12）
      switch (i) {
        case 0: case 1: case 2: case 3: case 4: case 5:
          character01.position.y = -11;
          break;
        case 6: case 7: case 8: case 9: case 10: case 11: case 12: case 13: case 14: case 15:
          character01.position.y = -10;
          break;
        case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 23: case 24: case 25: case 26: case 27: case 28:
          character01.position.y = -9;
          break;
        case 29: case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37: case 38: case 39: case 40: case 41: case 42: case 43:
          character01.position.y = -8;
          break;
        case 44: case 45: case 46: case 47: case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: case 58:
          character01.position.y = -7;
          break;
        case 59: case 60: case 61: case 62: case 63: case 64: case 65: case 66: case 67: case 68: case 69: case 70: case 71: case 72: case 73:
          character01.position.y = -6;
          break;
        case 74: case 75: case 76: case 77: case 78: case 79: case 80: case 81: case 82: case 83: case 84: case 85: case 86: case 87: case 88: case 89:
          character01.position.y = -5;
          break;
        case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97: case 98: case 99: case 100: case 101: case 102: case 103: case 104: case 105:
          character01.position.y = -4;
          break;
        case 106: case 107: case 108: case 109: case 110: case 111: case 112: case 113: case 114: case 115: case 116: case 117: case 118: case 119: case 120: case 121:
          character01.position.y = -3;
          break;
        case 122: case 123: case 124: case 125: case 126: case 127: case 128: case 129: case 130: case 131: case 132: case 133: case 134: case 135: case 136: case 137:
          character01.position.y = -2;
          break;
        case 138: case 139: case 140: case 141: case 142: case 143: case 144: case 145: case 146: case 147: case 148: case 149: case 150: case 151: case 152:
          character01.position.y = -1;
          break;
        case 153: case 154: case 155: case 156: case 157: case 158: case 159: case 160: case 161: case 162: case 163: case 164: case 165: case 166:
          character01.position.y = 0;
          break;
        case 167: case 168: case 169: case 170: case 171: case 172: case 173: case 174: case 175: case 176: case 177: case 178:
          character01.position.y = 1;
          break;
        case 179: case 180: case 181: case 182: case 183: case 184: case 185: case 186: case 187: case 188: case 189: case 190: case 191:
          character01.position.y = 2;
          break;
        case 192: case 193: case 194: case 195: case 196: case 197: case 198: case 199: case 200: case 201: case 202: case 203: case 204: case 205:
          character01.position.y = 3;
          break;
        case 206: case 207: case 208: case 209: case 210: case 211: case 212: case 213: case 214: case 215: case 216: case 217: case 218: case 219: case 220:
          character01.position.y = 4;
          break;
        case 221: case 222: case 223: case 224: case 225: case 226: case 227: case 228: case 229: case 230: case 231: case 232: case 233: case 234: case 235:
          character01.position.y = 5;
          break;
        case 236: case 237: case 238: case 239: case 240: case 241: case 242: case 243: case 244: case 245: case 246: case 247: case 248: case 249:
          character01.position.y = 6;
          break;
        case 250: case 251: case 252: case 253: case 254: case 255: case 256: case 257: case 258: case 259: case 260: case 261: case 262: case 263: case 264:
          character01.position.y = 7;
          break;
        case 265: case 266: case 267: case 268: case 269: case 270: case 271: case 272: case 273: case 274: case 275: case 276: case 277:
          character01.position.y = 8;
          break;
        case 278: case 279: case 280: case 281: case 282: case 283: case 284: case 285: case 286: case 287: case 288: case 289: case 290:
          character01.position.y = 9;
          break;
        case 291: case 292: case 293: case 294: case 295: case 296: case 297: case 298: case 299: case 300:
          character01.position.y = 10;
          break;
        case 301: case 302: case 303: case 304: case 305: case 306:
          character01.position.y = 11;
          break;
        case 307:
          character01.position.y = 12;
          break;
        default:
          break;
      }
      // x軸の指定（8px目をセンターにする：-8 ~ 7）
      switch (i) {
        case 74: case 90: case 106: case 122: case 138: case 153: case 167: case 179: case 192: case 206: case 221: case 236: case 250:
          character01.position.x = -8;
          break;
        case 29: case 44: case 59: case 75: case 91: case 107: case 123: case 139: case 154: case 168: case 180: case 193: case 207: case 222: case 237: case 251: case 265: case 278:
          character01.position.x = -7;
          break;
        case 6: case 16: case 30: case 45: case 60: case 76: case 92: case 108: case 124: case 140: case 155: case 169: case 181: case 194: case 208: case 223: case 238: case 252: case 266: case 279: case 291:
          character01.position.x = -6;
          break;
        case 0: case 7: case 17: case 31: case 46: case 61: case 77: case 93: case 109: case 125: case 141: case 156: case 170: case 182: case 195: case 209: case 224: case 239: case 253: case 267: case 280: case 292: case 301:
          character01.position.x = -5;
          break;
        case 1: case 8: case 18: case 32: case 47: case 62: case 78: case 94: case 110: case 126: case 142: case 157: case 171: case 183: case 196: case 210: case 225: case 240: case 254: case 268: case 281: case 293:
          character01.position.x = -4;
          break;
        case 2: case 9: case 19: case 33: case 48: case 63: case 79: case 95: case 111: case 127: case 143: case 158: case 172: case 184: case 197: case 211: case 226: case 241: case 255: case 269: case 282: case 302:
          character01.position.x = -3;
          break;
        case 3: case 10: case 20: case 34: case 49: case 64: case 80: case 96: case 112: case 128: case 144: case 159: case 173: case 185: case 198: case 212: case 227: case 242: case 256: case 270: case 283: case 294:
          character01.position.x = -2;
          break;
        case 4: case 11: case 21: case 35: case 50: case 65: case 81: case 97: case 113: case 129: case 145: case 160: case 174: case 186: case 199: case 213: case 228: case 243: case 257: case 271: case 284: case 295: case 303:
          character01.position.x = -1;
          break;
        case 5: case 12: case 22: case 36: case 51: case 66: case 82: case 98: case 114: case 130: case 146: case 161: case 175: case 187: case 200: case 214: case 229: case 244: case 258: case 272: case 285: case 296:
          character01.position.x = 0;
          break;
        case 13: case 23: case 37: case 52: case 67: case 83: case 99: case 115: case 131: case 147: case 162: case 176: case 188: case 201: case 215: case 230: case 245: case 259: case 273: case 286: case 297: case 304:
          character01.position.x = 1;
          break;
        case 14: case 24: case 38: case 53: case 68: case 84: case 100: case 116: case 132: case 148: case 163: case 177: case 189: case 202: case 216: case 231: case 246: case 260: case 274: case 287: case 305:
          character01.position.x = 2;
          break;
        case 15: case 25: case 39: case 54: case 69: case 85: case 101: case 117: case 133: case 149: case 164: case 178: case 190: case 203: case 217: case 232: case 247: case 261: case 275: case 288: case 298: case 307:
          character01.position.x = 3;
          break;
        case 26: case 40: case 55: case 70: case 86: case 102: case 118: case 134: case 150: case 165: case 191: case 204: case 218: case 233: case 248: case 262: case 276: case 289: case 299:
          character01.position.x = 4;
          break;
        case 27: case 41: case 56: case 71: case 87: case 103: case 119: case 135: case 151: case 166: case 205: case 219: case 234: case 249: case 263: case 290: case 300:
          character01.position.x = 5;
          break;
        case 28: case 42: case 57: case 72: case 88: case 104: case 120: case 136: case 152: case 220: case 235: case 264: case 277: case 306:
          character01.position.x = 6;
          break;
        case 43: case 58: case 73: case 89: case 105: case 121: case 137:
          character01.position.x = 7;
          break;
        default:
          break;
      }
      this.scene.add(character01);
      this.characterArray01.push(character01);
      // if (i < 68) {
      // } else {
      //   // character01.position.z = -1;
      //   this.scene.add(character01);
      //   this.characterArray02.push(character01);
      // }
    }

    for (let i = 0; i < boxCount_02; ++i) {
      let character02;

      // 色の指定
      switch (i) {
        // 黒：212121
        case 0: case 5: case 6: case 13: case 14: case 15: case 16: case 27: case 28: case 40: case 43: case 45: case 54: case 58: case 59: case 69: case 73: case 74: case 85: case 89: case 90: case 101: case 105: case 106: case 117: case 121: case 134: case 137: case 151: case 152: case 155: case 166: case 169: case 178: case 182: case 191: case 198: case 201: case 220: case 223: case 235: case 247: case 249: case 253: case 255: case 261: case 262: case 263: case 264: case 267: case 268: case 269: case 272: case 273: case 276: case 277: case 281: case 282: case 283: case 286: case 287: case 288: case 290: case 293: case 294: case 295: case 296: case 297: case 298: case 299: case 300: case 302: case 303: case 304: case 305: case 306: case 307:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_01);
          break;
        // 濃紺：313151
        case 22: case 26: case 29: case 44: case 46: case 47: case 63: case 112: case 113: case 122: case 127: case 132: case 135: case 138: case 141: case 142: case 149: case 153: case 165: case 167: case 179: case 181: case 192: case 206: case 221: case 224: case 233: case 236: case 241: case 246: case 250: case 265: case 278: case 291: case 301:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_02);
          break;
        // グレー：D1D9D9
        case 9: case 10: case 18: case 19: case 81: case 82: case 91: case 102: case 107: case 118: case 129: case 154: case 168: case 174: case 180: case 193: case 207: case 209: case 210: case 222: case 225: case 226: case 227: case 237: case 242: case 245: case 251: case 257: case 258: case 266: case 279: case 292:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_03);
          break;
        // 首元のブルー：5939A9
        case 144: case 147: case 156: case 158: case 163: case 170: case 171:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_04);
          break;
        // 濃いグレー：514951
        case 239: case 248: case 254: case 259: case 270: case 274: case 284: case 289:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_05);
          break;
        // むらさき：8971D9
        case 128: case 130: case 131: case 139: case 143: case 148: case 157: case 164: case 234: case 238: case 240: case 252: case 256: case 260: case 271: case 275: case 280: case 285:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_06);
          break;
        // 額当てのブルー：194999
        case 30: case 35: case 36: case 37: case 51: case 67: case 68: case 95: case 97: case 98: case 110: case 126: case 228: case 229: case 243: case 244:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_07);
          break;
        // きいろ：E9B921
        case 11: case 17: case 20: case 32: case 33: case 60: case 75: case 76: case 93: case 108: case 109: case 217: case 218: case 230: case 231: case 232:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_08);
          break;
        // ちゃいろ：612121
        case 4: case 12: case 42: case 61: case 71: case 77: case 87: case 92: case 94: case 103: case 123: case 136: case 140: case 145: case 146: case 185: case 188: case 194: case 196: case 203: case 205: case 208: case 211: case 213: case 216: case 219:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_09);
          break;
        // 肌色：E9A999
        case 41: case 55: case 62: case 70: case 78: case 84: case 86: case 99: case 100: case 114: case 115: case 119: case 159: case 160: case 161: case 162: case 172: case 173: case 175: case 176: case 177: case 184: case 186: case 187: case 189: case 197: case 199: case 200: case 202: case 212: case 214: case 215:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_10);
          break;
        // オレンジ：D16101
        case 1: case 2: case 3: case 7: case 8: case 21: case 23: case 24: case 25: case 31: case 34: case 124: case 125: case 195: case 204:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_11);
          break;
        // 薄い茶色：B97959
        case 56: case 57: case 72: case 79: case 80: case 83: case 88: case 104: case 120: case 183: case 190:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_12);
          break;
        // ブルー：2179D9
        case 38: case 39: case 48: case 49: case 50: case 52: case 53: case 64: case 65: case 66: case 96: case 111: case 116: case 133: case 150:
          character02 = new THREE.Mesh(this.boxGeometry, this.material_13);
          break;
        default:
          break;
      }
      // y軸の指定（12px目をセンターにする：-11 ~ 12）
      switch (i) {
        case 0: case 1: case 2: case 3: case 4: case 5:
          character02.position.y = -11;
          break;
        case 6: case 7: case 8: case 9: case 10: case 11: case 12: case 13: case 14: case 15:
          character02.position.y = -10;
          break;
        case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 23: case 24: case 25: case 26: case 27: case 28:
          character02.position.y = -9;
          break;
        case 29: case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37: case 38: case 39: case 40: case 41: case 42: case 43:
          character02.position.y = -8;
          break;
        case 44: case 45: case 46: case 47: case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: case 58:
          character02.position.y = -7;
          break;
        case 59: case 60: case 61: case 62: case 63: case 64: case 65: case 66: case 67: case 68: case 69: case 70: case 71: case 72: case 73:
          character02.position.y = -6;
          break;
        case 74: case 75: case 76: case 77: case 78: case 79: case 80: case 81: case 82: case 83: case 84: case 85: case 86: case 87: case 88: case 89:
          character02.position.y = -5;
          break;
        case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97: case 98: case 99: case 100: case 101: case 102: case 103: case 104: case 105:
          character02.position.y = -4;
          break;
        case 106: case 107: case 108: case 109: case 110: case 111: case 112: case 113: case 114: case 115: case 116: case 117: case 118: case 119: case 120: case 121:
          character02.position.y = -3;
          break;
        case 122: case 123: case 124: case 125: case 126: case 127: case 128: case 129: case 130: case 131: case 132: case 133: case 134: case 135: case 136: case 137:
          character02.position.y = -2;
          break;
        case 138: case 139: case 140: case 141: case 142: case 143: case 144: case 145: case 146: case 147: case 148: case 149: case 150: case 151: case 152:
          character02.position.y = -1;
          break;
        case 153: case 154: case 155: case 156: case 157: case 158: case 159: case 160: case 161: case 162: case 163: case 164: case 165: case 166:
          character02.position.y = 0;
          break;
        case 167: case 168: case 169: case 170: case 171: case 172: case 173: case 174: case 175: case 176: case 177: case 178:
          character02.position.y = 1;
          break;
        case 179: case 180: case 181: case 182: case 183: case 184: case 185: case 186: case 187: case 188: case 189: case 190: case 191:
          character02.position.y = 2;
          break;
        case 192: case 193: case 194: case 195: case 196: case 197: case 198: case 199: case 200: case 201: case 202: case 203: case 204: case 205:
          character02.position.y = 3;
          break;
        case 206: case 207: case 208: case 209: case 210: case 211: case 212: case 213: case 214: case 215: case 216: case 217: case 218: case 219: case 220:
          character02.position.y = 4;
          break;
        case 221: case 222: case 223: case 224: case 225: case 226: case 227: case 228: case 229: case 230: case 231: case 232: case 233: case 234: case 235:
          character02.position.y = 5;
          break;
        case 236: case 237: case 238: case 239: case 240: case 241: case 242: case 243: case 244: case 245: case 246: case 247: case 248: case 249:
          character02.position.y = 6;
          break;
        case 250: case 251: case 252: case 253: case 254: case 255: case 256: case 257: case 258: case 259: case 260: case 261: case 262: case 263: case 264:
          character02.position.y = 7;
          break;
        case 265: case 266: case 267: case 268: case 269: case 270: case 271: case 272: case 273: case 274: case 275: case 276: case 277:
          character02.position.y = 8;
          break;
        case 278: case 279: case 280: case 281: case 282: case 283: case 284: case 285: case 286: case 287: case 288: case 289: case 290:
          character02.position.y = 9;
          break;
        case 291: case 292: case 293: case 294: case 295: case 296: case 297: case 298: case 299: case 300:
          character02.position.y = 10;
          break;
        case 301: case 302: case 303: case 304: case 305: case 306:
          character02.position.y = 11;
          break;
        case 307:
          character02.position.y = 12;
          break;
        default:
          break;
      }
      // x軸の指定（8px目をセンターにする：-8 ~ 7）
      switch (i) {
        case 74: case 90: case 106: case 122: case 138: case 153: case 167: case 179: case 192: case 206: case 221: case 236: case 250:
          character02.position.x = -8;
          break;
        case 29: case 44: case 59: case 75: case 91: case 107: case 123: case 139: case 154: case 168: case 180: case 193: case 207: case 222: case 237: case 251: case 265: case 278:
          character02.position.x = -7;
          break;
        case 6: case 16: case 30: case 45: case 60: case 76: case 92: case 108: case 124: case 140: case 155: case 169: case 181: case 194: case 208: case 223: case 238: case 252: case 266: case 279: case 291:
          character02.position.x = -6;
          break;
        case 0: case 7: case 17: case 31: case 46: case 61: case 77: case 93: case 109: case 125: case 141: case 156: case 170: case 182: case 195: case 209: case 224: case 239: case 253: case 267: case 280: case 292: case 301:
          character02.position.x = -5;
          break;
        case 1: case 8: case 18: case 32: case 47: case 62: case 78: case 94: case 110: case 126: case 142: case 157: case 171: case 183: case 196: case 210: case 225: case 240: case 254: case 268: case 281: case 293:
          character02.position.x = -4;
          break;
        case 2: case 9: case 19: case 33: case 48: case 63: case 79: case 95: case 111: case 127: case 143: case 158: case 172: case 184: case 197: case 211: case 226: case 241: case 255: case 269: case 282: case 302:
          character02.position.x = -3;
          break;
        case 3: case 10: case 20: case 34: case 49: case 64: case 80: case 96: case 112: case 128: case 144: case 159: case 173: case 185: case 198: case 212: case 227: case 242: case 256: case 270: case 283: case 294:
          character02.position.x = -2;
          break;
        case 4: case 11: case 21: case 35: case 50: case 65: case 81: case 97: case 113: case 129: case 145: case 160: case 174: case 186: case 199: case 213: case 228: case 243: case 257: case 271: case 284: case 295: case 303:
          character02.position.x = -1;
          break;
        case 5: case 12: case 22: case 36: case 51: case 66: case 82: case 98: case 114: case 130: case 146: case 161: case 175: case 187: case 200: case 214: case 229: case 244: case 258: case 272: case 285: case 296:
          character02.position.x = 0;
          break;
        case 13: case 23: case 37: case 52: case 67: case 83: case 99: case 115: case 131: case 147: case 162: case 176: case 188: case 201: case 215: case 230: case 245: case 259: case 273: case 286: case 297: case 304:
          character02.position.x = 1;
          break;
        case 14: case 24: case 38: case 53: case 68: case 84: case 100: case 116: case 132: case 148: case 163: case 177: case 189: case 202: case 216: case 231: case 246: case 260: case 274: case 287: case 305:
          character02.position.x = 2;
          break;
        case 15: case 25: case 39: case 54: case 69: case 85: case 101: case 117: case 133: case 149: case 164: case 178: case 190: case 203: case 217: case 232: case 247: case 261: case 275: case 288: case 298: case 307:
          character02.position.x = 3;
          break;
        case 26: case 40: case 55: case 70: case 86: case 102: case 118: case 134: case 150: case 165: case 191: case 204: case 218: case 233: case 248: case 262: case 276: case 289: case 299:
          character02.position.x = 4;
          break;
        case 27: case 41: case 56: case 71: case 87: case 103: case 119: case 135: case 151: case 166: case 205: case 219: case 234: case 249: case 263: case 290: case 300:
          character02.position.x = 5;
          break;
        case 28: case 42: case 57: case 72: case 88: case 104: case 120: case 136: case 152: case 220: case 235: case 264: case 277: case 306:
          character02.position.x = 6;
          break;
        case 43: case 58: case 73: case 89: case 105: case 121: case 137:
          character02.position.x = 7;
          break;
        default:
          break;
      }
      this.scene.add(character02);
      this.characterArray02.push(character02);
    }


    // 軸ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // this のバインド
    this.render = this.render.bind(this);

    // キーの押下状態を保持するフラグ
    this.isDown = false;

    // キーの押下や離す操作を検出できるようにする
    window.addEventListener('keydown', (keyEvent) => {
      switch (keyEvent.key) {
        case ' ':
          this.isDown = true;
          break;
        default:
      }
    }, false);
    window.addEventListener('keyup', (keyEvent) => {
      this.isDown = false;
    }, false);

    // ウィンドウのリサイズを検出できるようにする
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループの設定
    requestAnimationFrame(this.render);

    // コントロールを更新
    this.controls.update();

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      // Y 軸回転 @@@
      // this.torusArray.forEach((torus) => {
      //   torus.rotation.y += 0.05;
      // });
      // this.scene.remove(character01);
      this.characterArray01.forEach((character01) => {
        // character01.rotation.y += 0.05;
        this.scene.remove(character01);
      });
      // this.characterArray02.forEach((character01) => {
      //   character01.rotation.y += 0.03;
      // });
    } else {
      this.characterArray01.forEach((character01) => {
        // character01.rotation.y += 0.05;
        this.scene.add(character01);
      });
    }

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}

