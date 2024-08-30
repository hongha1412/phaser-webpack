import RAPIER, { TempContactManifold } from "@dimforge/rapier2d-compat";
import { GameScene } from "../scenes";
import RapierBody from "./RapierBody";
import RapierHelper from "./RapierHelper";

export enum PlayerStates {
  STANDING,
  FALLING,
  CROUCHING,
  JUMPING,
  WALKING,
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  public static GRAVITY = 1800;
  public static JUMP_SPEED = -700;
  public static MOVE_SPEED = 275;
  public scene: GameScene;
  public rapierBody: RapierBody;
  public controller: RAPIER.KinematicCharacterController;
  public currentVelocityY: number = 0;
  public currentVelocityX: number = 0;
  public dy: number = -1;
  public prevY: number = -1;
  public dx: number = -1;
  public prevX: number = -1;
  private configs: string[] = ['GRAVITY', 'JUMP_SPEED', 'MOVE_SPEED'];
  private currentConfig = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "player");

    const animations: Phaser.Types.Animations.Animation[] = [
      { key: "stand", frames: this.scene.anims.generateFrameNumbers(this.texture.key, { frames: [0] }) },
      {
        key: "walk",
        frameRate: 12,
        frames: this.scene.anims.generateFrameNumbers(this.texture.key, { frames: [1, 2, 0] }),
        repeat: -1,
      },
      { key: "jump", frames: this.scene.anims.generateFrameNumbers(this.texture.key, { frames: [2] }) },
      { key: "crouch", frames: this.scene.anims.generateFrameNumbers(this.texture.key, { frames: [3] }) },
    ];
    animations.forEach((animation) => this.scene.anims.create(animation));

    this.scene.collisionGroup.add(this);

    this.rapierBody = RapierHelper.enablePhysics(this, 'character') as RapierBody;
    this.controller = (this['rapier'] as RAPIER.World).createCharacterController(0.01);
    this.controller.enableAutostep(0.7, 0.3, true);
    this.controller.enableSnapToGround(0.7);
    // RapierHelper.movableConfig(this);
    this.rapierBody.enableSensor();

    this.scene.add
      .existing(this)
      .setState(PlayerStates.STANDING);
  }

  public setState(value: PlayerStates) {
    switch (value) {
      case PlayerStates.CROUCHING:
        this.play("crouch");
        break;

      case PlayerStates.FALLING:
        this.play("jump");
        break;

      case PlayerStates.JUMPING:
        this.play("jump").playAudio("jump");
        break;

      case PlayerStates.STANDING:
        this.play("stand");
        break;

      case PlayerStates.WALKING:
        this.play("walk");
        break;
    }

    return super.setState(value);
  }

  onFloor() {
    // const pos = this.rapierBody.translation();
    // pos.y += (this.displayHeight / 2) + 1;
    // const ray = new RAPIER.Ray(pos, new RAPIER.Vector2(0, 1));
    // const hit = (this.scene as GameScene).rapier.castRay(ray, 1.1, false);
    // return hit != null && hit.collider !== this.rapierBody.collider;
    return this.rapierBody.blocked.bottom;
  }

  public preUpdate(time: number, delta: number) {
    const { left, right, down, jump, increase, decrease, selectUp, selectDown } = this.scene.inputs;
    const flipX = left && !right ? true : right ? false : this.flipX;
    const directionX = -Number(left) + Number(right);
    const accelerationX = directionX * Player.MOVE_SPEED;
    const deltaS: number = delta / 1000;

    if (selectUp) {
      this.currentConfig++;
      if (this.currentConfig >= this.configs.length) {
        this.currentConfig = 0;
      }
      console.log('SELECT', this.configs[this.currentConfig]);
    }
    if (selectDown) {
      this.currentConfig--;
      if (this.currentConfig < 0) {
        this.currentConfig = this.configs.length;
      }
      console.log('SELECT', this.configs[this.currentConfig]);
    }
    if (increase) {
      Player[this.configs[this.currentConfig]] += 1;
      console.log(this.configs[this.currentConfig], 'new value', Player[this.configs[this.currentConfig]]);
    }
    if (decrease) {
      Player[this.configs[this.currentConfig]] -= 1;
      console.log(this.configs[this.currentConfig], 'new value', Player[this.configs[this.currentConfig]]);
    }

    switch (this.state) {
      case PlayerStates.STANDING:
        if (!this.onFloor()) {
          this.setState(PlayerStates.FALLING);
        } else if (jump) {
          this.currentVelocityY = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (left || right) {
          this.setState(PlayerStates.WALKING);
        } else if (down) {
          this.setState(PlayerStates.CROUCHING);
        }
        break;

      case PlayerStates.WALKING:
        this.setFlipX(flipX);
        this.currentVelocityX = accelerationX;

        if (!this.onFloor()) {
          this.setState(PlayerStates.FALLING);
        } else if (jump) {
          this.currentVelocityY = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (!left && !right) {
          this.currentVelocityX = 0;
          if (down) {
            this.setState(PlayerStates.CROUCHING);
          } else {
            this.setState(PlayerStates.STANDING);
          }
        }
        break;

      case PlayerStates.CROUCHING:
        if (!this.onFloor()) {
          this.setState(PlayerStates.FALLING);
        } else if (jump) {
          this.currentVelocityY = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (!down) {
          this.setState(PlayerStates.STANDING);
        }
        break;

      case PlayerStates.JUMPING:
        if (this.rapierBody.linvel().y > 0) {
          this.setState(PlayerStates.FALLING);
        } else if (this.currentVelocityY < 0) {
        }

      case PlayerStates.FALLING:
        this.setFlipX(flipX);
        this.currentVelocityX = accelerationX;

        if (this.onFloor()) {
          if (left || right) {
            this.setState(PlayerStates.WALKING);
          } else {
            this.setState(PlayerStates.STANDING);
          }
        }
        break;
    }
    // Gravity simulate
    this.currentVelocityY += Player.GRAVITY * deltaS;
    
    // Process blocked
    if ((this.rapierBody.blocked.bottom && this.currentVelocityY > 0) || (this.rapierBody.blocked.top && this.currentVelocityY < 0)) this.currentVelocityY = 0;
    if ((this.rapierBody.blocked.left && this.currentVelocityX < 0) || (this.rapierBody.blocked.right && this.currentVelocityX > 0)) this.currentVelocityX = 0;

    // this.rapierBody.setLinvel(velocity);
    // Process movement and update position
    let deltaMovement = { x: 0, y: 0 };
    deltaMovement.x += this.currentVelocityX * deltaS;
    deltaMovement.y += this.currentVelocityY * deltaS;
    this.controller.computeColliderMovement(this.rapierBody.collider, deltaMovement, undefined, undefined, (target: RAPIER.Collider) => {
      return this.rapierBody.filterPredicate(target);
    });
    let movement = this.controller.computedMovement();
    let newPos = this.rapierBody.translation();
    newPos.x += movement.x;
    newPos.y += movement.y;
    this.rapierBody.rigidBody.setNextKinematicTranslation(newPos);
    this.rapierBody.setBlock();
    if (this.controller.numComputedCollisions() > 0) {
      // Process collide events
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
        let collision = this.controller.computedCollision(i);
        // console.log('collision', collision);
      }
    }
    //this.rapierBody.rapier

    super.preUpdate(time, delta);
    if (this.prevX >= 0) {
      this.dx = this.x - this.prevX;
    }
    if (this.prevY >= 0) {
      this.dy = this.y - this.prevY;
    }
    this.prevX = this.x;
    this.prevY = this.y;
  }

  public setSize(height: number) {
    super.setSize(16, height);
    return this;
  }

  public playAudio(key: string) {
    this.scene.sound.play(key, { volume: 0.5 });

    return this;
  }
}
