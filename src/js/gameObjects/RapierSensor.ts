import RAPIER from "@dimforge/rapier2d-compat";

export default class RapierSensor {
    private _targetHandles: number[] = [];
    private _collider: RAPIER.Collider;
    private rapier: RAPIER.World;
    private readonly rayShape: RAPIER.Cuboid;
    private rayShapeSize: number = 2;
    private name: string = '';

    get collider(): RAPIER.Collider {
        return this._collider;
    }

    set collider(value: RAPIER.Collider) {
        this._collider = value;
    }

    constructor(rapier: RAPIER.World, colliderDesc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody, dir: 'top' | 'bottom' | 'left' | 'right') {
        this.rapier = rapier;
        this.name = dir;
        this._collider = this.rapier.createCollider(colliderDesc, parent);
        if (!this._collider.isSensor()) {
            this._collider.setSensor(true);
        }
        // Create ray for detect sensor lost collide with obstacle
        switch (dir) {
            case 'top':
            case 'bottom':
                this.rayShape = new RAPIER.Cuboid((parent.userData as any).width / 2, this.rayShapeSize / 2);
                break;
            case 'left':
            case 'right':
                this.rayShape = new RAPIER.Cuboid(this.rayShapeSize / 2, (parent.userData as any).height / 2);
                break;
        }
    }

    get targetHandles(): number[] {
        return this._targetHandles;
    }

    set targetHandles(value: number[]) {
        this._targetHandles = value;
    }

    isCollidingWith(target: RAPIER.Collider): boolean {
        return this.rapier.intersectionPair(this.collider, target);
        // let castVel = new RAPIER.Vector2(1, 1);
        // const hit = this.rapier.castShape(this.collider.translation(), 0, castVel, this.rayShape, 0, this.rayShapeSize, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
        // return hit?.collider === target;
    }

    containsTarget(target: number): boolean {
        return this.targetHandles.indexOf(target) >= 0;
    }

    addTarget(target: number) {
        this.targetHandles.push(target);
    }

    removeTarget(target: number) {
        const targetIndex: number = this.targetHandles.indexOf(target);
        if (targetIndex < 0) return;
        this.targetHandles.splice(targetIndex, 1);
    }

    resetTarget() {
        this.targetHandles = [];
    }

    setEnabled(enabled: boolean) {
        this.collider.setEnabled(enabled);
    }

    isEnabled(): boolean {
        return this.collider.isEnabled();
    }
}
