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
    this.rapier.forEachRigidBody(body => {
      const go = body.userData as any;
      if (!go) return;
      go.x = body.translation().x;
      go.y = body.translation().y;
    });
    const toWorld = (base, pathData) => {
      const vertices = [];
      for (let i = 0; i < pathData.length; i++) {
        vertices.push({ x: pathData[i] + base.x - base.width/2, y: pathData[++i] + base.y - base.height/2 });
      }
      return vertices;
    }

    // Update rapier bodies
    this.rapier.bodies.forEach((body: RAPIER.RigidBody) => {
      if (body.bodyType() !== RigidBodyType.KinematicPositionBased || !body.userData || !body.userData['rapierBody']) return;
      body.userData['x'] = body.userData['rapierBody'].translation().x;
      body.userData['y'] = body.userData['rapierBody'].translation().y;
    });
    
    this.eventQueue.drainContactForceEvents((e: RAPIER.TempContactForceEvent) => {
      console.log('event', e);
    });
    this.drawDebug();
  }

  public create() {
    this.debug = this.add.graphics({ lineStyle: { color: 0xff0000, width: 1 } }).setDepth(99999);
    this.graphics = this.add.graphics({ lineStyle: { color: 0xff0000, width: 1 } }).setDepth(999999);
    const tilemap = this.make.tilemap({ key: "tilemap" });
    const tileset = tilemap.addTilesetImage("tiles");
    const tileLayer = tilemap.createLayer(0, tileset, 0, 0).forEachTile((tile) => {
      // if (tile.index !== 6 && tile.index !== 10) return;
      // const brick = this.add.polygon(tile.pixelX, tile.pixelY, [0, 0, tile.width, 0, tile.width, tile.height, 0, tile.height]);
      // (RapierHelper.enablePhysics(brick, 'fixed') as RapierBody);
      // brick.setName(brick.getData('body').collider.handle);
    });
    const ground = this.add.rectangle(tilemap.widthInPixels / 2, tilemap.heightInPixels - 8, tilemap.widthInPixels, 16).setName(`ground`);
    (RapierHelper.enablePhysics(ground, 'fixed') as RapierBody);
    ground.setName(ground.getData('body').collider.handle);

    this._collisionGroup = this.add.group();
    this._objectGroup = this.add.group();

    this._inputs = new GameInputs(this.input);
    // this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
    //   const obstacle = this.add.polygon(p.x, p.y, [0, 0, 5, 0, 5, 5, 0, 5], 0xff0000, 1).setOrigin(0);
    //   obstacle.addToUpdateList();
    //   RapierHelper.enablePhysics(obstacle, 'dynamic');
    //   RapierHelper.movableConfig(obstacle);
    // });

    this._player = new Player(this, 32, 100).setDataEnabled();
    // for (let i = 0; i <= 100; i++) {
    //   new Player(this, 32, 100).setDataEnabled()
    // }

    // this._polygon = this.add.polygon(100, 100, [0, 0, 5, 0, 200, 50, 0, 50], 0xff00ff, 0xffff00);
    // RapierHelper.enablePhysics(this._polygon, 'fixed');
    // const extra = this.add.polygon(10, 120, [0, 0, 5, 10, 10, 5, 15, 5, 20, 10, 15, 20, 0, 20], 0xff00ff, 0xffff00);
    // RapierHelper.enablePhysics(extra, 'fixed');
    RapierHelper.enablePhysics(this.add.polygon(5, 140, [0, 0, 2558, 0, 2559, 32, 0, 32, 0, 0], 0x00ffff, 0.8).setOrigin(0));

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
