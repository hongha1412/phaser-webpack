import RAPIER from "@dimforge/rapier2d-compat";
import RapierBody from "./RapierBody";
import RapierConfig from "./RapierConfig";

export default class RapierHelper {
    /**
     * Batch process for method {@link enablePhysics}
     * @param go Game Object array
     * @param bodyType Rapier physics body type or rigid body describe
     * @param colliderType Rapier collider type or collider describe
     * @param args Arguments for collider in case of collider type is cuboid (displayWidth & displayHeight) or convexHull (pathData vertices)
     * @return RapierBody array
     */
    public static batchEnablePhysics(go: any[], bodyType: 'fixed' | 'dynamic' | 'character' | RAPIER.RigidBodyDesc = 'fixed', colliderType?: 'cuboid' | 'convexHull' | RAPIER.ColliderDesc, ...args: any[]): RapierBody[] {
        // Process for batch enable physics
        const bodies: RapierBody[] = [];
        go.forEach(item => {
            const body = RapierHelper.enablePhysics(item, bodyType, colliderType, ...args) as RapierBody;
            if (body) {
                bodies.push(body);
            }
        });
        return bodies;
    }

    /**
     * Enable rapier physics body for given game object
     * <p>NOTE: game object should have below properties:</p>
     * <ul>
     *     <li>constructor.name: 'Rectangle' | 'Polygon' (other will be stand for client character)</li>
     *     <li>width/height (if constructor.name is Rectangle)</li>
     *     <li>pathData (if constructor.name is Polygon)</li>
     * </ul>
     * @param go Game object
     * @param bodyType Rapier physics body type or rigid body describe
     * @param colliderType Rapier collider type or collider describe
     * @param args Arguments for collider in case of collider type is cuboid (displayWidth & displayHeight) or convexHull (pathData vertices)
     * @return RapierBody or null
     */
    public static enablePhysics(go: any, bodyType: 'fixed' | 'dynamic' | 'character' | RAPIER.RigidBodyDesc = 'fixed', colliderType?: 'cuboid' | 'convexHull' | RAPIER.ColliderDesc, ...args: any[]): RapierBody | null {
        // Process for single item
        let rapier: RAPIER.World | undefined = undefined;
        if (go.scene && go.scene.rapier) {
            // Get rapier physics world from client
            rapier = go.scene.rapier;
            go.rapier = rapier;
        } else if (go.rapier) {
            // Get rapier physics world from server
            rapier = go.rapier;
        }
        if (!rapier) {
            console.error('Physics world not found for object', go);
            return null;
        }

        // Prepare rigid body describe
        let bodyDesc: RAPIER.RigidBodyDesc;
        switch (bodyType) {
            case 'fixed':
                bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .lockTranslations()
                    .setGravityScale(0)
                    .setLinearDamping(1000)
                    .setAngularDamping(1000)
                    .setDominanceGroup(127); // Used for check fixed body or not
                break;
            case 'dynamic':
                bodyDesc = RAPIER.RigidBodyDesc.dynamic();
                break;
            case 'character':
                bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
                break;
            default:
                bodyDesc = bodyType;
                break;
        }
        // Config common settings
        bodyDesc.setUserData(go)
            .lockRotations()
            .setTranslation(go.x, go.y);

        // Prepare collider describe
        let colliderDesc: RAPIER.ColliderDesc;
        if (colliderType === 'cuboid') {
            colliderDesc = RAPIER.ColliderDesc.cuboid(args[0], args[1]);
        } else if (colliderType === 'convexHull') {
            colliderDesc = RAPIER.ColliderDesc.roundConvexHull(args[0], args[1] || 0.1) as RAPIER.ColliderDesc;
        } else if (colliderType) {
            colliderDesc = colliderType;
        } else {
            if (go.constructor.name === 'Rectangle') {
                colliderDesc = RAPIER.ColliderDesc.cuboid(go.width / 2, go.height / 2);
            } else if (go.constructor.name === 'Polygon') {
                colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(go.pathData)) as RAPIER.ColliderDesc;
            } else {
                colliderDesc = RAPIER.ColliderDesc.cuboid(go.width / 2, go.height / 2);
            }
        }
        // Config common settings
        if (RapierHelper.isFixedBody(bodyDesc)) {
            colliderDesc.setMass(Number.MAX_SAFE_INTEGER)
                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        }

        // Create rigid body
        // @ts-ignore
        const rigidBody: RAPIER.RigidBody = rapier.createRigidBody(bodyDesc);
        // Create collider
        // @ts-ignore
        const collider: RAPIER.Collider = rapier.createCollider(colliderDesc, rigidBody);
        // Assign back to game object
        if (go.setDataEnabled) {
            go.setDataEnabled();
        }
        const rapierBody = new RapierBody(rapier, rigidBody, collider);
        rapierBody.checkBlock.bottom = false;
        rapierBody.checkBlock.left = false;
        rapierBody.checkBlock.right = false;
        go.setData(RapierConfig.A_RAPIER_BODY, rapierBody);
        return rapierBody;
    }

    /**
     * Get rapier body from given game object
     * @param go Game object
     * @return RapierBody object or undefined
     */
    public static getRapierBody(go: any): RapierBody | undefined {
        return go?.getData(RapierConfig.A_RAPIER_BODY);
    }

    /**
     * Disable rapier physics body for given game object
     * <p>NOTE: game object should have below properties:</p>
     * <ul>
     *     <li>rapier: Rapier physics world</li>
     *     <li>{@link RapierBody} (response of go.getData({@link RapierConfig.A_RAPIER_BODY})
     * </ul>
     * @param go Game object
     */
    public static disablePhysics(go: any) {
        if (!go.rapier) {
            console.error('Physics world not found for object', go);
            return;
        }
        const body: RapierBody = go.getData(RapierConfig.A_RAPIER_BODY);
        if (!body || !body.collider) {
            console.error('Physics body not found for object', go);
            return;
        }

        const rapier: RAPIER.World = go.rapier;
        rapier.removeCollider(body.collider, false);
    }

    /**
     * Config for movable object physics
     * <p>NOTE: game object should have below properties:</p>
     * <ul>
     *     <li>rapier: Rapier physics world</li>
     *     <li>{@link RapierBody} (response of go.getData({@link RapierConfig.A_RAPIER_BODY})
     * </ul>
     * @param go Movable object
     */
    public static movableConfig(go: any) {
        const rapier: RAPIER.World = go.rapier;
        if (!rapier) {
            console.error('Physics world not found for object', go);
            return;
        }
        const body: RapierBody = go.getData(RapierConfig.A_RAPIER_BODY);
        if (!body) {
            console.error('Physics body not found for object', go);
            return;
        }
        const hook: RAPIER.PhysicsHooks = go.scene.hooks;
        body.enableCcd(true);
        body.rigidBody.setSoftCcdPrediction(150);
    }

    public static dumpManifold(manifold: RAPIER.TempContactManifold) {
        const dummy = {};
        // @ts-ignore
        Object.getOwnPropertyNames(manifold.__proto__).filter(p => !p.startsWith('constructor') && !p.startsWith('free')).forEach(p => {
            dummy[p] = manifold[p]();
        });
        console.info(dummy);
    }

    public static isFixedBody(body: RAPIER.RigidBody | RAPIER.RigidBodyDesc) {
        if (body instanceof RAPIER.RigidBodyDesc) {
            return (body as RAPIER.RigidBodyDesc).dominanceGroup === 127;
        } else if (body instanceof RAPIER.RigidBody) {
            return (body as RAPIER.RigidBody).dominanceGroup() === 127;
        }
    }
}
