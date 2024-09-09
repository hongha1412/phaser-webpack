import RAPIER from "@dimforge/rapier2d-compat";
import RapierHelper from "./RapierHelper";
import RapierSensor from "./RapierSensor";
import { RapierDir } from "./RapierType";

export default class RapierBody {
    private readonly _rapier: RAPIER.World;
    private _rigidBody: RAPIER.RigidBody;
    private _collider: RAPIER.Collider;
    // ===== Used for KCC =====
    private _controller: RAPIER.KinematicCharacterController;
    private _vx: number = 0;
    private _vy: number = 0;
    private _vxy: number = 0;
    private _prevX: number = 0;
    private _prevY: number = 0;
    private _dx: number = 0;
    private _dy: number = 0;
    // ========================
    private _obstacles: Map<number, boolean> = new Map<number, boolean>();
    private _obstacleCollision: Map<number, RAPIER.CharacterCollision> = new Map<number, RAPIER.CharacterCollision>();
    private _sensorTop: RapierSensor | undefined;
    private _sensorBottom: RapierSensor | undefined;
    private _sensorLeft: RapierSensor | undefined;
    private _sensorRight: RapierSensor | undefined;
    private _checkBlock: RapierDir = {
        top: true, bottom: true, left: true, right: true
    };
    private _blocked: RapierDir = {
        top: false, bottom: false, left: false, right: false
    };
    intersectDepth: number[] = [];

    get rigidBody(): RAPIER.RigidBody {
        return this._rigidBody;
    }

    set rigidBody(value: RAPIER.RigidBody) {
        this._rigidBody = value;
    }

    get controller(): RAPIER.KinematicCharacterController {
        return this._controller;
    }

    set controller(value: RAPIER.KinematicCharacterController) {
        this._controller = value;
    }

    get vx(): number {
        return this._vx;
    }

    set vx(value: number) {
        if (value > 1800)
            this._vx = 1800;
        else
            this._vx = value;
    }

    get vy(): number {
        return this._vy + this._vxy;
    }

    set vy(value: number) {
        if (value > 1800)
            this._vy = 1800;
        else
            this._vy = value;
    }

    get vxy(): number {
        return this._vy;
    }

    set vxy(value: number) {
        if (value > 1800)
            this._vxy = 1800;
        else
            this._vxy = value;
    }

    get prevX(): number {
        return this._prevX;
    }

    get prevY(): number {
        return this._prevY;
    }

    get dx(): number {
        return Math.round(this._dx);
    }

    get dy(): number {
        return Math.round(this._dy);
    }

    get collider(): RAPIER.Collider {
        return this._collider;
    }

    set collider(value: RAPIER.Collider) {
        this._collider = value;
    }

    get obstacles(): Map<number, boolean> {
        return this._obstacles;
    }

    get obstacleCollision(): Map<number, RAPIER.CharacterCollision> {
        return this._obstacleCollision;
    }

    get sensorTop(): RapierSensor | undefined {
        return this._sensorTop;
    }

    get sensorBottom(): RapierSensor | undefined {
        return this._sensorBottom;
    }

    get sensorLeft(): RapierSensor | undefined {
        return this._sensorLeft;
    }

    get sensorRight(): RapierSensor | undefined {
        return this._sensorRight;
    }

    get blocked(): RapierDir {
        return this._blocked;
    }

    get rapier(): RAPIER.World {
        return this._rapier;
    }

    get checkBlock(): RapierDir {
        return this._checkBlock;
    }

    set checkBlock(value: RapierDir) {
        this._checkBlock = value;
    }

    constructor(rapier: RAPIER.World, body: RAPIER.RigidBody, collider: RAPIER.Collider) {
        this._rapier = rapier;
        this._rigidBody = body;
        this._collider = collider;

        const currentPos = this._rigidBody.translation();
        this._prevX = currentPos.x;
        this._prevY = currentPos.y;
    }

    /**
     * IMPORTANT: Should call in game loop for character object to remove not collide obstacle
     * This method will remove far brick from object's sign and reset blocked sides value
     */
    update(collideEvents: { handle1: number, handle2: number, started: boolean }[]) {
        this.updateObstacles();
    }

    updateObstacles() {
        if (!this._sensorTop || !this._sensorBottom || !this._sensorLeft || !this._sensorRight) return;
        const updatedObstacles: Set<number> = new Set<number>();

        ['Top', 'Bottom', 'Left', 'Right'].forEach(side => {
            const sensor: RapierSensor = this[`_sensor${side}`];
            sensor.resetTarget();
            // Check intersect with obstacles
            this.obstacles.forEach((_, handle) => {
                const targetCollider = this.rapier.getCollider(handle);
                if (!targetCollider) return;
                if (sensor.isCollidingWith(targetCollider)) {
                    sensor.addTarget(handle);
                    updatedObstacles.add(handle);
                }
            });
            // Update blocked side
            this.blocked[side.toLowerCase()] = sensor.targetHandles.length > 0;
        });
        // Update obstacles
        this.obstacles.forEach((_, targetHandle: number) => {
            if (!updatedObstacles.has(targetHandle)) {
                this.obstacles.delete(targetHandle);
                this.obstacleCollision.delete(targetHandle);
            }
        });
    }

    onFloor(): boolean {
        if (!this.blocked.bottom || !this.sensorBottom) return false;
        let collision: RAPIER.CharacterCollision;
        for (let handle of this.sensorBottom.targetHandles) {
            if (!this.obstacleCollision.has(handle)) return false;
            collision = this.obstacleCollision.get(handle) as RAPIER.CharacterCollision;
            // Normal vector direction of character is bottom to top
            if (collision.normal2.y > 0) {
                return true;
            }
        }
        return false;
    }

    enableController() {
        const height = (this.rigidBody.userData as any)?.displayHeight || 0;
        const width = (this.rigidBody.userData as any)?.displayWidth || 0;
        const bodyPos = this.rigidBody.translation();
        const colliderPos = this.collider.translation();
        const offset = new RAPIER.Vector2(colliderPos.x - bodyPos.x, colliderPos.y - bodyPos.y);
        if (height <= 0 || width <= 0) return this;
        const bias: number = 2;

        // Create sensors
        if (this._sensorTop && !this._sensorTop.isEnabled()) {
            this._sensorTop.setEnabled(true);
        } else {
            this._sensorTop = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(width / 2 + 1, bias).setTranslation(offset.x, offset.y - (height / 2)), this.rigidBody, 'top');
        }
        if (this._sensorBottom && !this._sensorBottom.isEnabled()) {
            this._sensorBottom.setEnabled(true);
        } else {
            this._sensorBottom = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(width / 2 + 1, bias).setTranslation(offset.x, offset.y + (height / 2)), this.rigidBody, 'bottom');
        }
        if (this._sensorLeft && !this._sensorLeft.isEnabled()) {
            this._sensorLeft.setEnabled(true);
        } else {
            this._sensorLeft = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(bias, height / 2 - 1).setTranslation(offset.x - width / 2, offset.y), this.rigidBody, 'left');
        }
        if (this._sensorRight && !this._sensorRight.isEnabled()) {
            this._sensorRight.setEnabled(true);
        } else {
            this._sensorRight = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(bias, height / 2 - 1).setTranslation(offset.x + width / 2, offset.y), this.rigidBody, 'right');
        }

        // Create controller
        this._controller = this.rapier.createCharacterController(0.1);
        // this._controller.enableAutostep(7, 3, true);
        // this._controller.enableSnapToGround(7);
        // this._controller.setMaxSlopeClimbAngle(70 * Math.PI / 180);
        // this._controller.setMinSlopeSlideAngle(90 * Math.PI / 180);
    }

    disableSensor() {
        ['Top', 'Bottom', 'Left', 'Right'].forEach(side => {
            if (this[`_sensor${side}`] && this[`_sensor${side}`].isEnabled()) {
                this[`_sensor${side}`].setEnabled(false);
            }
        });
    }

    setCollisionGroup(value: number): RapierBody {
        this.collider.setCollisionGroups(value);
        return this;
    }

    addCollisionGroupMember(value: number): RapierBody {
        return this.updateCollisionGroup((groups: number, filters: number) => ((groups | value) << 16) | filters);
    }

    removeCollisionGroupMember(value: number): RapierBody {
        return this.updateCollisionGroup((groups: number, filters: number) => ((groups & ~value) << 16) | filters);
    }

    addCollisionGroupFilter(value: number): RapierBody {
        return this.updateCollisionGroup((groups: number, filters: number) => ((groups << 16) | (filters | value)));
    }

    removeCollisionGroupFilter(value: number): RapierBody {
        return this.updateCollisionGroup((groups: number, filters: number) => ((groups << 16) | (filters & ~value)));
    }

    updateCollisionGroup(fn: (groups: number, filters: number) => number): RapierBody {
        const groups: number = this.collider.collisionGroups() >> 16;
        const filters: number = this.collider.collisionGroups() & 0xffff;
        this.collider.setCollisionGroups(fn(groups, filters));
        return this;
    }

    setSolverGroup(value: number): RapierBody {
        this.collider.setSolverGroups(value);
        return this;
    }

    lockTranslation(locked: boolean = true, wakeUp: boolean = true) {
        this.rigidBody.lockTranslations(locked, wakeUp);
    }

    setNextKinematicTranslation(newPos: RAPIER.Vector) {
        const currentPos = this.rigidBody.translation();
        this._prevX = currentPos.x;
        this._prevY = currentPos.y;
        this.rigidBody.setNextKinematicTranslation(newPos);
        this._dx = newPos.x - this._prevX;
        this._dy = newPos.y - this._prevY;
    }

    sleep() {
        if (!this.rigidBody.isSleeping())
            this.rigidBody.sleep();
    }

    wakeUp() {
        if (this.rigidBody.isSleeping())
            this.rigidBody.wakeUp();
    }

    translation(): RAPIER.Vector {
        return this.rigidBody.translation();
    }

    linvel(): RAPIER.Vector {
        return this.rigidBody.linvel();
    }

    get gameObject(): any {
        return this.rigidBody.userData;
    }

    setTranslation(pos: { x: number, y: number }, wakeUp: boolean = true) {
        this.rigidBody.setTranslation(pos, wakeUp);
        this._prevX = pos.x;
        this._prevY = pos.y;
        this._vx = 0;
        this._vy = 0;
    }

    setLinvel(velocity: { x: number, y: number }, wakeUp: boolean = true) {
        this.rigidBody.setLinvel(velocity, wakeUp);
    }

    enableCcd(enable: boolean) {
        this.rigidBody.enableCcd(enable);
    }

    setMass(value: number) {
        this.collider.setMass(value);
    }

    setFriction(value: number) {
        this.collider.setFriction(value);
    }

    setFrictionCombineRule(value: RAPIER.CoefficientCombineRule) {
        this.collider.setFrictionCombineRule(value);
    }

    setRestitution(value: number) {
        this.collider.setRestitution(value);
    }

    setRestitutionCombineRule(value: RAPIER.CoefficientCombineRule) {
        this.collider.setRestitutionCombineRule(value);
    }

    filterPredicate(target: RAPIER.Collider): boolean {
        if (this.obstacles.has(target.handle)) return this.obstacles.get(target.handle) as boolean;
        return true; // Default collide with obstacle
    }

    collideDetection(collision: RAPIER.CharacterCollision): number {
        // Check collision information valid
        if (!collision.collider) return -1;
        // Add collision event detail for onFloor check
        this.obstacleCollision.set(collision.collider.handle, collision);
        // Skip calculate collision behaviour if existing
        if (this.obstacles.has(collision.collider.handle)) {
            return this.obstacles.get(collision.collider.handle) ? Number.MAX_SAFE_INTEGER: Number.MIN_SAFE_INTEGER;
        }
        const targetRapierBody = RapierHelper.getRapierBody(collision.collider.parent()?.userData);
        if (!targetRapierBody) {
            return this.processCollideObstacle(collision.collider.handle, -1);
        }

        const topSide = Math.abs(collision.normal1.y) > Math.abs(collision.normal1.x) && collision.normal1.y < 0 && targetRapierBody.checkBlock.top;
        const bottomSide = Math.abs(collision.normal1.y) > Math.abs(collision.normal1.x) && collision.normal1.y > 0 && targetRapierBody.checkBlock.bottom;
        const leftSide = Math.abs(collision.normal1.x) > Math.abs(collision.normal1.y) && collision.normal1.x > 0 && targetRapierBody.checkBlock.left;
        const rightSide = Math.abs(collision.normal1.x) > Math.abs(collision.normal1.y) && collision.normal1.x < 0 && targetRapierBody.checkBlock.right;

        // Check if the character is moving towards the side that allows collisions
        if (topSide) {
            return this.processCollideObstacle(collision.collider.handle, 0); // Collide with top side if moving down
        } else if (bottomSide) {
            return this.processCollideObstacle(collision.collider.handle, 1); // Collide with bottom side if moving up
        } else if (leftSide) {
            return this.processCollideObstacle(collision.collider.handle, 2); // Collide with left side if moving right
        } else if (rightSide) {
            return this.processCollideObstacle(collision.collider.handle, 3); // Collide with right side if moving left
        }
        return this.processCollideObstacle(collision.collider.handle, -1); // Default collide all sides
    }

    processCollideObstacle(targetHandle: number, targetSide: number) {
        let sensor: RapierSensor | undefined;
        switch (targetSide) {
            case 0:
                sensor = this.sensorBottom;
                this.blocked.bottom = true;
                this.vy = 0;
                break;
            case 1:
                sensor = this.sensorTop;
                this.blocked.top = true;
                this.vy = 0;
                break;
            case 2:
                sensor = this.sensorRight;
                this.blocked.right = true;
                this.vx = 0;
                break;
            case 3:
                sensor = this.sensorLeft;
                this.blocked.left = true;
                this.vx = 0;
                break;
        }
        this.obstacles.set(targetHandle, targetSide >= 0);
        sensor?.addTarget(targetHandle);
        return targetSide;
    }
}
