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
  public static MOVE_SPEED = 100;
  public scene: GameScene;
  public rapier: RAPIER.World;
  public rapierBody: RapierBody;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "player");
    this.rapier = scene.rapier;

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
    this.rapierBody.enableController();

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
    const { left, right, down, jump } = this.scene.inputs;
    const flipX = left && !right ? true : right ? false : this.flipX;
    const directionX = -Number(left) + Number(right);
    const accelerationX = directionX * Player.MOVE_SPEED;
    const deltaS: number = delta / 1000;
    this.rapierBody.updateObstacles();

    switch (this.state) {
      case PlayerStates.STANDING:
        if (!this.onFloor()) {
          this.setState(PlayerStates.FALLING);
        } else if (jump) {
          this.rapierBody.vy = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (left || right) {
          this.setState(PlayerStates.WALKING);
        } else if (down) {
          this.setState(PlayerStates.CROUCHING);
        }
        break;

      case PlayerStates.WALKING:
        this.setFlipX(flipX);
        this.rapierBody.vx = accelerationX;

        if (!this.onFloor()) {
          this.setState(PlayerStates.FALLING);
        } else if (jump) {
          this.rapierBody.vy = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (!left && !right) {
          this.rapierBody.vx = 0;
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
          this.rapierBody.vy = Player.JUMP_SPEED;
          this.setState(PlayerStates.JUMPING);
        } else if (!down) {
          this.setState(PlayerStates.STANDING);
        }
        break;

      case PlayerStates.JUMPING:
        if (this.rapierBody.linvel().y > 0) {
          this.setState(PlayerStates.FALLING);
        } else if (this.rapierBody.vy < 0) {
        }

      case PlayerStates.FALLING:
        this.setFlipX(flipX);
        this.rapierBody.vx = accelerationX;

        if (this.onFloor()) {
          if (left || right) {
            this.setState(PlayerStates.WALKING);
          } else {
            this.setState(PlayerStates.STANDING);
          }
        }
        break;
    }

    // Sync bodies position with physics world
    this.rapier.bodies.forEach((body: RAPIER.RigidBody) => {
        const go: any = body.userData as any;
        if (!go || !body.isEnabled() || RapierHelper.isFixedBody(body)) return;

        const deltaS = delta / 1000;
        const rapierBody: RapierBody = go.rapierBody;
        if (!rapierBody) return;
        // Update game object position
        go.x = body.translation().x;
        go.y = body.translation().y;

        // Process movement control
        if (!rapierBody.controller) return;
        // Update obstacles
        rapierBody.update([]);
        // Apply gravity if not standing on ground
        if (!rapierBody.onFloor())
            rapierBody.vy += (1800 * deltaS);
        // Calculate movement
        let deltaMovement = { x: rapierBody.vx * deltaS, y: rapierBody.vy * deltaS };
        this.predictMovement(deltaMovement, rapierBody);
        rapierBody.controller.computeColliderMovement(rapierBody.collider, deltaMovement, undefined, undefined, (target: RAPIER.Collider) => {
            return rapierBody.filterPredicate(target);
        });
        let movement = rapierBody.controller.computedMovement();
        let newPos = rapierBody.translation();
        newPos.x += movement.x;
        newPos.y += movement.y;
        rapierBody.setNextKinematicTranslation(newPos);

        if (rapierBody.controller.numComputedCollisions() > 0) {
            const scene = (rapierBody.rigidBody.userData as any).scene;
            // Process collide events
            let collision: RAPIER.CharacterCollision | null = null;
            for (let i = 0; i < rapierBody.controller.numComputedCollisions(); i++) {
                if (!(collision = rapierBody.controller.computedCollision(i)) || !collision.collider) continue;
            }
        }
    });

    super.preUpdate(time, delta);
  }

  public setSize(height: number) {
    super.setSize(16, height);
    return this;
  }

  public playAudio(key: string) {
    this.scene.sound.play(key, { volume: 0.5 });

    return this;
  }

  predictMovement(deltaMovement: { x: number; y: number }, rapierBody: RapierBody) {
    const predictDelta = { x: deltaMovement.x, y: deltaMovement.y };
    const originObstacles = Array.from(rapierBody.obstacles.values());

    // Predict next movement
    rapierBody.controller.computeColliderMovement(rapierBody.collider, predictDelta, undefined, undefined, (target: RAPIER.Collider) => {
        return rapierBody.filterPredicate(target);
    });
    if (rapierBody.controller.numComputedCollisions() > 0) {
        // Process collide events
        let collision: RAPIER.CharacterCollision | null = null;
        for (let i = 0; i < rapierBody.controller.numComputedCollisions(); i++) {
            if (!(collision = rapierBody.controller.computedCollision(i))) continue;
            rapierBody.collideDetection(collision);
        }
    }
    // Recursive predict movement when obstacles changed
    if (!this.compareArray(originObstacles, Array.from(rapierBody.obstacles.values()))) {
        this.predictMovement(deltaMovement, rapierBody);
    }
  }

  private compareArray(array1: any[], array2: any[]): boolean {
    return array1.length === array2.length && array1.every((value, index) => value === array2[index]);
  }
}
