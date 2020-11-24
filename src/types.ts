import {PrivilegeManager, Role} from "./am-i-allowed";

/**
 * Represents someone who acts on something; it could be a logged in user, or a non logged in user
 */
export interface IActor {
    id
    groups: string[] // permission group ids
}

/**
 * This is the signature of the permission checker. It is possible that an entity (virtual or not) will implement their own special logic and
 * even call the default logic from their own because it is also accessible as function `standardPermissionChecker`.
 * The specialContext object let the custom logic related to special data that should be provided in the calls to
 */
export type PermissionChecker = (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) => Promise<boolean>

/**
 * Something which is managed by this privilege management system. It can be an actual application entity, or a
 * virtual one, such as the system, the backoffice, etc. As long as it adheres to this interface - it can be managed!
 *
 *  *  */
export interface IPrivilegeManaged {

    /**
     * A required identifier
     */
    id

    /**
     * Should be used in simple JSON entities
     */
    ___name?: string
    /**
     * list of groups of the instance
     */
    permissionGroupIds?: string[]
    /**
     * Optional custom permission logic
     */
    customPermissionChecker?: PermissionChecker
    /**
     * If meta data is not provided, default one is automatically created. It must be a static member.
     * */
    permissionsMetaData?: PermissionsMetaData

    /**
     *optionally, you can point to another object to inherit its permissions. It's good for tree like structures, when
     * you inherit the parent's node's permissions by default.
     * */
    permissionSuper?: () => Promise<IPrivilegeManaged>
}

/**
 * This represent the operation attempted on the entity
 */
export type Operation = string

/**
 * You can use anything as the persistent storage for the permission system, as long as it is compatible with this interface
 */
export abstract class IPermissionStore {
    abstract assignRole(entityId: any, actorId: any, roleName: string): Promise<void>

    abstract removeRole(entityId: any, actorId: any, roleName: string): Promise<void>

    abstract getRolesForUser(actorId: any, entity: IPrivilegeManaged, metadata: PermissionsMetaData): Promise<Role[]>

    abstract saveRole(entityTypeName: string, role: Role): Promise<void>

    abstract deleteRole(roleName: string, entityTypeName: string)
}

export interface PMD {
    parentNames?: string[]
    defaultVisitorPermissions?: Set<Operation>
    defaultUserPermissions?: Set<Operation>
    defaultGroupMemberPermissions?: Set<Operation>
}

/**
 * with that, sophisticated permission schemes can easily be defined per entity-types.
 */
export class PermissionsMetaData implements PMD {

    // internally populated in the role definition process
    roles: { [roleName: string]: Role } = {}

    constructor(readonly name: string, {
        defaultVisitorPermissions = new Set(),
        parentNames = [],
        defaultUserPermissions = new Set(),
        defaultGroupMemberPermissions = new Set()
    }: PMD) {
        this.parentNames = parentNames
        this.defaultVisitorPermissions = defaultVisitorPermissions
        this.defaultUserPermissions = defaultUserPermissions
        this.defaultGroupMemberPermissions = defaultGroupMemberPermissions
    }

    defaultVisitorPermissions: Set<string>
    defaultUserPermissions: Set<string>
    defaultGroupMemberPermissions: Set<string>

    parentNames: string[];
}