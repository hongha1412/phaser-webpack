import RAPIER from "@dimforge/rapier2d-compat";
import RapierBody from "./RapierBody";

export default class RapierSensor {
    private _targetRapierBodies: RapierBody[] = [];
    private _collider: RAPIER.Collider;
    private rapier: RAPIER.World;

    get collider(): RAPIER.Collider {
        return this._collider;
    }

    set collider(value: RAPIER.Collider) {
        this._collider = value;
    }

    constructor(rapier: RAPIER.World, colliderDesc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody) {
        this.rapier = rapier;
        this._collider = this.rapier.createCollider(colliderDesc, parent);
        if (!this._collider.isSensor()) {
            this._collider.setSensor(true);
        }
    }

    get targetRapierBodies(): RapierBody[] {
        return this._targetRapierBodies;
    }

    set targetRapierBodies(value: RapierBody[]) {
        this._targetRapierBodies = value;
    }

    contains(target: RapierBody): boolean {
        return this.targetRapierBodies.indexOf(target) >= 0;
    }

    pushTarget(target: RapierBody) {
        this.targetRapierBodies.push(target);
    }

    removeTarget(target: RapierBody) {
        const targetIndex: number = this.targetRapierBodies.indexOf(target);
        if (targetIndex < 0) return;
        this.targetRapierBodies.splice(targetIndex, 1);
    }

    resetTarget() {
        this.targetRapierBodies = [];
    }

    setEnabled(enabled: boolean) {
        this.collider.setEnabled(enabled);
    }

    isEnabled(): boolean {
        return this.collider.isEnabled();
    }
}
