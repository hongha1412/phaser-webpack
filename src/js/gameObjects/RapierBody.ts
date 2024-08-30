import RAPIER, { RigidBody } from "@dimforge/rapier2d-compat";
import RapierConfig from "./RapierConfig";
import RapierHelper from "./RapierHelper";
import RapierSensor from "./RapierSensor";
import { RapierDir } from "./RapierType";

export default class RapierBody {
    private readonly _rapier: RAPIER.World;
    private _rigidBody: RAPIER.RigidBody;
    private _collider: RAPIER.Collider;
    private _obstacles: Map<number, boolean> = new Map<number, boolean>();
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

    get collider(): RAPIER.Collider {
        return this._collider;
    }

    set collider(value: RAPIER.Collider) {
        this._collider = value;
    }

    get obstacles(): Map<number, boolean> {
        return this._obstacles;
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
    }

    /**
     * IMPORTANT: Should call in game loop for character object to remove not collide obstacle 
     */
    updateObstacles(collideEvents: any[]) {
        collideEvents.forEach((e) => {
            const { handle1, handle2, started } = e;
            let targetHandle: number = -1;
            if (!started) {
                // Get sensor handle list
                const handles: number[] = [];
                if (this.sensorTop && this.sensorTop.isEnabled()) {
                    ['Top', 'Bottom', 'Left', 'Right'].forEach(side => {
                        handles.push(this[`_sensor${side}`].collider.handle);
                    });
                } else {
                    handles.push(this.collider.handle);
                }
                // Check target handle
                if (handles.indexOf(handle1) >= 0) targetHandle = handle2;
                else if (handles.indexOf(handle2) >= 0) targetHandle = handle1;
                if (targetHandle < 0) return;
                // Remove no collide anomore handle
                if (this.obstacles.has(targetHandle)) {
                    this.obstacles.delete(targetHandle);
                }
            }
        });
    }

    enableSensor() {
        const height = (this.rigidBody.userData as any)?.displayHeight || 0;
        const width = (this.rigidBody.userData as any)?.displayWidth || 0;
        if (height <= 0 || width <= 0) return this;
        const adj: number = 0;

        // Create sensors
        if (this._sensorTop && !this._sensorTop.isEnabled()) {
            this._sensorTop.setEnabled(true);
        } else {
            this._sensorTop = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(width / 2, 0.1).setTranslation(0, -adj -height / 2), this.rigidBody);
        }
        if (this._sensorBottom && !this._sensorBottom.isEnabled()) {
            this._sensorBottom.setEnabled(true);
        } else {
            this._sensorBottom = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(width / 2, 0.1).setTranslation(0, adj + height / 2), this.rigidBody);
        }
        if (this._sensorLeft && !this._sensorLeft.isEnabled()) {
            this._sensorLeft.setEnabled(true);
        } else {
            this._sensorLeft = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(0.1, height / 2 - 1).setTranslation(-adj -width / 2, 0), this.rigidBody);
        }
        if (this._sensorRight && !this._sensorRight.isEnabled()) {
            this._sensorRight.setEnabled(true);
        } else {
            this._sensorRight = new RapierSensor(this.rapier, RAPIER.ColliderDesc.cuboid(0.1, height / 2 - 1).setTranslation(adj + width / 2, 0), this.rigidBody);
        }
    }

    disableSensor() {
        ['Top', 'Bottom', 'Left', 'Right'].forEach(side => {
            if (this[`_sensor${side}`] && this[`_sensor${side}`].isEnabled()) {
                this[`_sensor${side}`].setEnabled(false);
            }
        });
    }

    public setBlock() {
        if (this.rigidBody.isSleeping()) return;
        this._blocked = { top: false, bottom: false, left: false, right: false };
        this.intersectDepth = [];
        const thisGo: any = this.rigidBody.userData;
        if (!thisGo) {
            console.error('Rigid body have no game object for set block', this);
            return;
        }

        // Detect collided sides
        const sides = ['Top', 'Bottom', 'Left', 'Right'];
        for (let i = 0; i < sides.length; i++) {
            const sensor: RapierSensor = this[`_sensor${sides[i]}`];
            if (!sensor || !sensor.isEnabled()) return;
            this.rapier.intersectionPairsWith(sensor.collider, (target: RAPIER.Collider) => {
                const targetGo: any = target.parent().userData;
                const targetRapierBody: RapierBody | undefined = targetGo?.getData(RapierConfig.A_RAPIER_BODY);
                if (!targetGo || !targetRapierBody) return;
                switch (i) {
                    case 0:
                        if (thisGo.dy <= (targetGo.dy || 0) && targetRapierBody.checkBlock.bottom)
                            this.blocked[sides[i].toLowerCase()] = true;
                        break;
                    case 1:
                        if (thisGo.dy >= (targetGo.dy || 0) && targetRapierBody.checkBlock.top)
                            this.blocked[sides[i].toLowerCase()] = true;
                        break;
                    case 2:
                        if (thisGo.dx <= (targetGo.dx || 0) && targetRapierBody.checkBlock.right)
                            this.blocked[sides[i].toLowerCase()] = true;
                        break;
                    case 3:
                        if (thisGo.dx >= (targetGo.dx || 0) && targetRapierBody.checkBlock.left)
                            this.blocked[sides[i].toLowerCase()] = true;
                        break;
                }
            });
        }

        this.rapier.contactPairsWith(this.collider, (target: RAPIER.Collider) => {
            if (target.shape.type === RAPIER.ShapeType.ConvexPolygon) {
                // Calculate contact depth
                this.rapier.contactPair(this.collider, target, (manifold: RAPIER.TempContactManifold, flipped: boolean) => {
                    for (let i = 0; i < manifold.numContacts(); i++) {
                        this.intersectDepth.push(manifold.contactDist(i));
                    }
                });
            }
        });
    }

    setCollisionGroup(value: number | 'object' | 'character' | 'mob' | 'npc', push: boolean = false): RapierBody {
        if (typeof value === 'number') {
            this.collider.setCollisionGroups((push ? this.collider.collisionGroups() : 0) & value);
        } else {
            switch (value) {
                case 'object':
                    this.collider.setCollisionGroups((push ? this.collider.collisionGroups() : 0) & RapierConfig.C_OBJECT);
                    break;
                case 'character':
                    this.collider.setCollisionGroups((push ? this.collider.collisionGroups() : 0) & RapierConfig.C_CHAR);
                    break;
                case 'mob':
                    this.collider.setCollisionGroups((push ? this.collider.collisionGroups() : 0) & RapierConfig.C_MOB);
                    break;
                case 'npc':
                    this.collider.setCollisionGroups((push ? this.collider.collisionGroups() : 0) & RapierConfig.C_NPC);
                    break;
            }
        }
        return this;
    }

    addCollisionGroup(value: number | 'object' | 'character' | 'mob' | 'npc'): RapierBody {
        return this.setCollisionGroup(value, true);
    }

    setSolverGroup(value: number | 'left' | 'up' | 'right' | 'down', push: boolean = false): RapierBody {
        if (typeof value === 'number') {
            this.collider.setSolverGroups((push ? this.collider.solverGroups() : 0) & value);
        } else {
            switch (value) {
                case 'left':
                    this.collider.setSolverGroups((push ? this.collider.solverGroups() : 0) & RapierConfig.S_LEFT);
                    break;
                case 'up':
                    this.collider.setSolverGroups((push ? this.collider.solverGroups() : 0) & RapierConfig.S_UP);
                    break;
                case 'right':
                    this.collider.setSolverGroups((push ? this.collider.solverGroups() : 0) & RapierConfig.S_RIGHT);
                    break;
                case 'down':
                    this.collider.setSolverGroups((push ? this.collider.solverGroups() : 0) & RapierConfig.S_DOWN);
                    break;
            }
        }
        return this;
    }

    addSolverGroup(value: number | 'left' | 'up' | 'right' | 'down') {
        return this.setSolverGroup(value, true);
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

    collideFilterPredicate(target: RAPIER.Collider): boolean {
        const targetGo: any = target.parent()?.userData as any;
        if (!targetGo) {
            console.error('Target game object not existing on target collider', target);
            // Default allow collide events
            return true;
        }
        const targetRapierBody = RapierHelper.getRapierBody(targetGo);
        if (!targetRapierBody) {
            console.error('RapierBody not existing on target game object', targetGo);
            // Default allow collide events
            return true;
        }
        const thisGo: any = this.rigidBody.userData as any;

        const checkBlock = targetRapierBody.checkBlock;
        const thisVelocity = { x: thisGo.dx || 0, y: thisGo.dy || 0 };
        const targetVelocity = { x: targetGo.dx || 0, y: targetGo.dy || 0 };
        if (checkBlock.top) {
            if (thisVelocity.y == 0 && targetVelocity.y === 0) {
                // They will collide but neither of them are moving
                return false;
            } else if (thisVelocity.y > targetVelocity.y) {
                // This body is moving down and/or target is moving up
                if (thisGo.skipGroundCollide && targetRapierBody.checkBlock.top) {
                    return false;
                }
                // TODO: Check max intersect on this body
                return true;
            }
        }
        if (checkBlock.bottom) {
            if (thisVelocity.y == 0 && targetVelocity.y === 0) {
                // They will collide but neither of them are moving
                return false;
            } else if (thisVelocity.y < targetVelocity.y) {
                // This body is moving up and/or target is moving down
                // TODO: Check max intersect on this body
                return true;
            }
        }
        if (checkBlock.left) {
            if (thisVelocity.x == 0 && targetVelocity.x === 0) {
                // They will collide but neither of them are moving
                return false;
            } else if (thisVelocity.x > targetVelocity.x) {
                // This body is moving right and / or target is moving left
                // TODO: Check max intersect on this body
                return true;
            }
        }
        if (checkBlock.right) {
            if (thisVelocity.x == 0 && targetVelocity.x === 0) {
                // They will collide but neither of them are moving
                return false;
            } else if (thisVelocity.x < targetVelocity.x) {
                // This body is moving right and / or target is moving left
                // TODO: Check max intersect on this body
                return true;
            }
        }
        return false;
    }

    filterPredicate(target: RAPIER.Collider) {
        if (this.obstacles.has(target.handle)) return this.obstacles.get(target.handle);
        const result = this.collideFilterPredicate(target);

        // Save colliding obstacle for future check
        this.obstacles.set(target.handle, result);
        return result;
    }
}
