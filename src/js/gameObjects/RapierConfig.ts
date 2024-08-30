export default class RapierConfig {
    /** Rapier body data key */
    public static readonly A_RAPIER_BODY = 'body';
    // Definition of solver groups
    public static readonly S_LEFT = 0x01;
    public static readonly S_UP = RapierConfig.S_LEFT << 1;
    public static readonly S_RIGHT = RapierConfig.S_UP << 1;
    public static readonly S_DOWN = RapierConfig.S_RIGHT << 1;
    // Definition of collision groups
    public static readonly C_OBJECT = 0x01;
    public static readonly C_CHAR = RapierConfig.C_OBJECT << 1;
    public static readonly C_MOB = RapierConfig.C_CHAR << 1;
    public static readonly C_NPC = RapierConfig.C_MOB << 1;
}
