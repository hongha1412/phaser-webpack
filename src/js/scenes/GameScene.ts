import { GameInputs } from "../inputs/GameInputs";
import { Player } from "../gameObjects/Player";
import Awaitloader from "phaser3-rex-plugins/plugins/awaitloader";
import RapierHelper from "../gameObjects/RapierHelper";
import RapierBody from "../gameObjects/RapierBody";
import RAPIER, { RevoluteImpulseJoint, RigidBodyType } from "@dimforge/rapier2d-compat";
import RapierHooks from "../gameObjects/RapierHooks";
import RapierConfig from "../gameObjects/RapierConfig";

export class GameScene extends Phaser.Scene {
  private _collisionGroup: Phaser.GameObjects.Group;
  private _inputs: GameInputs;
  private _player: Player;
  private _polygon: Phaser.GameObjects.Polygon;
  // For RAPIER
  private _objectGroup: Phaser.GameObjects.Group;
  private debug: Phaser.GameObjects.Graphics;
  private eventQueue: RAPIER.EventQueue;
  graphics: Phaser.GameObjects.Graphics;
  rapier: RAPIER.World;
  hooks: RapierHooks | undefined;
  collideEvents: { handle1: number, handle2: number, started: boolean }[] = [];


  constructor() {
    super({ key: "game", active: false, visible: false });
  }

  public preload() {
    this.load.tilemapTiledJSON("tilemap", "./assets/tilemaps/tilemap.json");
    Awaitloader.call(this.load, async (successCallback, failureCallback) => {
      RAPIER.init().then(() => {
        this.rapier = new RAPIER.World({ x: 0, y: 1500 });
        this.rapier.integrationParameters.maxCcdSubsteps = 10;
        this.eventQueue = new RAPIER.EventQueue(true);
        successCallback();
      }).catch((e) => {
        console.error(e);
        failureCallback();
      });
    }, this);
  }

  public update() {
    this.rapier.step(this.eventQueue);

    // Drain collide events
    this.collideEvents = [];
    this.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      this.collideEvents.push({ handle1, handle2, started });
      const c1 = this.rapier.getCollider(handle1);
      const c2 = this.rapier.getCollider(handle2);
      this.graphics.strokePoints((c1.parent().userData as any).pathData, true, true);
      this.graphics.strokePoints((c2.parent().userData as any).pathData, true, true);
      console.log(c1, c2, started);
    });

    // Update rapier bodies
    this.rapier.bodies.forEach((body: RAPIER.RigidBody) => {
      if (body.bodyType() !== RigidBodyType.KinematicPositionBased || !body.userData || !body.userData['rapierBody']) return;
      body.userData['x'] = body.userData['rapierBody'].translation().x;
      body.userData['y'] = body.userData['rapierBody'].translation().y;
      ((body.userData as any).getData(RapierConfig.A_RAPIER_BODY) as RapierBody)?.updateObstacles(this.collideEvents);
    });
    
    // const draw = (pathData) => {
    //   pathData
    // }
    this.eventQueue.drainContactForceEvents((e: RAPIER.TempContactForceEvent) => {
      console.log('event', e);
    });
    this.drawDebug();
  }

  public create() {
    this.debug = this.add.graphics({ lineStyle: { color: 0xff0000, width: 1 } }).setDepth(99999);
    this.graphics = this.add.graphics({ lineStyle: { color: 0xff0000, width: 1 } }).setDepth(99999);
    const tilemap = this.make.tilemap({ key: "tilemap" });
    const tileset = tilemap.addTilesetImage("tiles");
    const tileLayer = tilemap.createLayer(0, tileset, 0, 0).forEachTile((tile) => {
      if (tile.index !== 6 && tile.index !== 10) return;
      const x = tile.pixelX + tile.width / 2;
      const y = tile.pixelY + tile.height / 2;
      const brick = this.add.rectangle(x, y, tile.width, tile.height);
      (RapierHelper.enablePhysics(brick, 'fixed') as RapierBody);
      brick.setName(brick.getData('body').collider.handle);
    });
    const ground = this.add.rectangle(tilemap.widthInPixels / 2, tilemap.heightInPixels - 8, tilemap.widthInPixels, 16).setName(`ground`);
    (RapierHelper.enablePhysics(ground, 'fixed') as RapierBody);
    ground.setName(ground.getData('body').collider.handle);

    this._collisionGroup = this.add.group();
    this._objectGroup = this.add.group();

    this._inputs = new GameInputs(this.input);

    this._player = new Player(this, 32, 100).setDataEnabled();
    // for (let i = 0; i <= 100; i++) {
    //   new Player(this, 32, 100).setDataEnabled()
    // }

    this._polygon = this.add.polygon(100, 100, [0, 0, 5, 0, 10, 5, 15, 5, 20, 10, 15, 20, 0, 20], 0xff00ff, 0xffff00);
    RapierHelper.enablePhysics(this._polygon, 'fixed');
    const extra = this.add.polygon(10, 120, [0, 0, 5, 10, 10, 5, 15, 5, 20, 10, 15, 20, 0, 20], 0xff00ff, 0xffff00);
    RapierHelper.enablePhysics(extra, 'fixed');

    const { widthInPixels, heightInPixels } = tilemap;

    this.hooks = new RapierHooks(this.rapier, this);

    this.cameras.main.setBounds(0, 0, widthInPixels, heightInPixels).startFollow(this.player, true);
  }

  public get collisionGroup() {
    return this._collisionGroup;
  }

  public get inputs() {
    return this._inputs;
  }

  public get player() {
    return this._player;
  }

  public drawDebug() {
    if (this.debug) {
      this.debug.clear();

      const debugRender = this.rapier.debugRender();
      const vertices = debugRender.vertices;
      const colors = debugRender.colors;

      for (let i = 0; i < vertices.length; i += 4)
      {
          const x1 = vertices[i];
          const y1 = vertices[i + 1];
          const x2 = vertices[i + 2];
          const y2 = vertices[i + 3];

          const colorIndex = i * 2;
          const r = colors[colorIndex];
          const g = colors[colorIndex + 1];
          const b = colors[colorIndex + 2];
          const a = colors[colorIndex + 3];

          this.debug.lineStyle(2, Phaser.Display.Color.GetColor(r * 255, g * 255, b * 255), a);
          this.debug.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  preloadAwait(asyncMethod: Function, ...methodArgs: any) {
    // @ts-ignore
    Awaitloader.call(this.load, (successCallback: Function, failureCallback: Function) => {
      asyncMethod(methodArgs).then(() => {
        successCallback();
      }).catch((e: any) => {
        failureCallback(e);
      });
    });
  }
}
