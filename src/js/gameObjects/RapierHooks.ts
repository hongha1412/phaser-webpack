import RAPIER, { TempContactManifold } from "@dimforge/rapier2d-compat";
import RapierBody from "./RapierBody";
import RapierHelper from "./RapierHelper";
import RapierConfig from "./RapierConfig";

export default class RapierHooks implements RAPIER.PhysicsHooks {
    private rapier: RAPIER.World;
    private scene: any;

    constructor(rapier: RAPIER.World, scene?: any) {
        this.rapier = rapier;
        this.scene = scene;
    }

    filterContactPair(collider1: RAPIER.ColliderHandle, collider2: RAPIER.ColliderHandle, body1: RAPIER.RigidBodyHandle, body2: RAPIER.RigidBodyHandle): RAPIER.SolverFlags | null {
        const b1: RapierBody = this.getBody(body1);
        const b2: RapierBody = this.getBody(body2);

        // Default execute collide events
        if (!b1 || !b2) return RAPIER.SolverFlags.COMPUTE_IMPULSE;

        if (b1.collider.shape.type !== RAPIER.ShapeType.ConvexPolygon && b2.collider.shape.type !== RAPIER.ShapeType.ConvexPolygon) {
            return RAPIER.SolverFlags.COMPUTE_IMPULSE;
        }

        // this.rapier.contactPair(b1.collider, b2.collider, (manifold: TempContactManifold, flipped: boolean) => {
        //     console.log(manifold);
        // });

        let result = RAPIER.SolverFlags.COMPUTE_IMPULSE;
        // Going to use sensor
        const dx = b1.rigidBody.userData['dx'] || b2.rigidBody.userData['dx'] || 0;
        const dy = b1.rigidBody.userData['dy'] || b2.rigidBody.userData['dy'] || 0;
        const i = b1.intersectDepth.pop() || b2.intersectDepth.pop() || 0;
        if ((Math.abs(dy) > Math.abs(dx) && dy < 0) || Math.abs(i) > Math.abs(dy) + 4) {
            result = RAPIER.SolverFlags.EMPTY;
        }

        return result;
    }

    filterIntersectionPair(collider1: RAPIER.ColliderHandle, collider2: RAPIER.ColliderHandle, body1: RAPIER.RigidBodyHandle, body2: RAPIER.RigidBodyHandle): boolean {
        return true;
    }

    private getBody(body: RAPIER.RigidBodyHandle): RapierBody | null {
        const rigidBody: RAPIER.RigidBody = this.rapier.getRigidBody(body);
        if (!rigidBody) {
            console.error('Rigid body for collide check not found');
            return null;
        }

        const go: any = rigidBody.userData;
        if (!go) {
            console.error('Game object for collide check not found');
            return null;
        }

        return go.getData(RapierConfig.A_RAPIER_BODY);
    }
}