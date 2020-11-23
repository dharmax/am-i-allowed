/**
 * Special terms:
 *
 * The relation between ac actor to a given entity may be one of the following:
 * - Visitor: a not logged-in user
 * - User: a logged-in user, with an account
 * - Group Member: a user that shares the group of the entity
 * - a role owner: there's a role explicitly assigned to the use on the entity
 *
 *
 *
 */

/**
 * Represents someone who acts on something; it could be a logged in user, or a non logged in user
 */
export interface IActor {
    id
    groups: string[] // permission group ids
}


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
 * This is the signature of the permission checker. It is possible that an entity (virtual or not) will implement their own special logic and
 * even call the default logic from their own because it is also accessible as function `standardPermissionChecker`.
 * The specialContext object let the custom logic related to special data that should be provided in the calls to
 */
export type PermissionChecker = (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) => Promise<boolean>

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

    abstract getRolesForUser(actorId: any, entity: IPrivilegeManaged): Promise<Role[]>

    abstract saveRole(entityTypeName:string, role: Role): Promise<void>

    abstract deleteRole(roleName: string, entityTypeName: string)
}

/**
 * This is the main class. Normally you'd need just one PrivilegeManager for the whole application.
 * Use it to check permissions
 */
export class PrivilegeManager {

    readonly operationTree: OperationTree

    /**
     * Builds a privilege manager instance.
     * @param store the persistency backend for the permission storage
     * @param operationsPlugin an optional opreation tree transformer, in case you wish to alter the default one, add more operations, etc
     */
    constructor(private store: IPermissionStore, operationsPlugin = (operationTree) => operationTree) {
        this.operationTree = new OperationTree(operationsPlugin(DefaultOperationsTreeScheme))
    }

    /**
     * Check for if the actor is allowed to do something and throws an exception if he isn't
     * @param actor
     * @param operation
     * @param entity
     * @param specialContext for custom logic
     */
    async test(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<void> {
        // @ts-ignore
        const isAllowed = await checkPermissionSoft(...arguments)
        if (!isAllowed) { // @ts-ignore
            throw new NoPrivilegeException(...arguments)
        }
    }

    /**
     * Check if the actor is allowed to do
     * @param actor
     * @param operation
     * @param entity
     * @param specialContext
     */
    isAllowed(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

        if (!this.operationTree.find(operation))
            throw new Error(`Operation ${operation.toString()} is not defined. Consider adding it to the operations tree.`)

        if (entity.customPermissionChecker)
            // @ts-ignore
            return entity.customPermissionChecker(this, ...arguments)
        // @ts-ignore
        return standardPermissionChecker(this, ...arguments)
    }

    /**
     * assign a role to use in entity
     * @param entity the entity
     * @param actor either IActor or an id
     * @param role the role
     */
    assignRole(entity: IPrivilegeManaged, actor: IActor | any, role: Role): Promise<void> {
        return this.store.assignRole(entity.id, actor?.id || actor, role.roleName)
    }

    async getRolesForUserId(id: any, entity: IPrivilegeManaged): Promise<Role[]> {
        return this.store.getRolesForUser(id, entity)
    }

    /**
     * Define a new role. Also add itself to the corresponding entityType
     * @param roleName name of role
     * @param entityTypes The entity types this role is applicable to
     * @param operations the operation the role holder may do on the entities of the aforementioned types
     */
    addRole(roleName: string, operations: Operation[], ...entityTypes: (string | Function)[]):Role {
        return new Role(this, roleName, operations, ...entityTypes)
    }

    deleteRole(roleName: string, entityTypeName: string): Promise<void> {
        return this.store.deleteRole(roleName, entityTypeName)
    }

    saveRole(entityTypeName: string, role: Role) {
        return this.store.saveRole( entityTypeName, role)
    }
}

/**
 * This structure defines the operations taxonomy. When a permission for a specific operation is given, it implicitly
 * denotes that its child operations are also permitted. The purpose of such a taxonomy is to save redundant coding and
 * confusing/illogical permission definitions.
 * The tree can be altered @see PrivilegeManager constructor
 */
export const DefaultOperationsTreeScheme = {
    Admin: {
        AddAdmin: {},
        DeleteDatabase: {
            ManageDatabase: {
                ManageUsers: {
                    SendMessage: {},
                }
            }
        },
        Manage: {
            PowerUser: {
                Execute: {
                    GenericAction: {},
                    Trade: {
                        AcceptPayment: {
                            Sell: {
                                Load: {}
                            },
                        },
                        Buy: {
                            Lease: {},
                            Pay: {},
                        },
                    },
                },
                Join: {},
                Disable: {
                    Ban: {
                        Suspend: {
                            Warn: {},
                            Flag: {}
                        }
                    }
                },
                Delete: {
                    EditAnything: {
                        WriteAnything: {
                            WriteCommon: {
                                ReadCommon: {}
                            },
                            ReadAnything: {
                                ReadDeep: {
                                    ReadCommon: {
                                        ReadHeadline: {}
                                    },
                                }
                            },
                        },
                        AddStuff: {
                            Comment: {},
                            Rate: {
                                DownVote: {
                                    UpVote: {}
                                }
                            },
                            DetachItem: {
                                AttachItem: {}
                            }
                        }
                    }
                },
            }
        }
    }
}


class NoPrivilegeException extends Error {
    constructor(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) {
        super(`${actor.id} attempted unprivileged operation ${operation.toString()} on ${entity.id}`)
    }

    message: string;
    name: string;
}

/**
 * This is the standardPermissionChecker logic. First, explicit role assignments are checked, then group related, which means,
 * if user and entity groups intersect, then either the default group permissions are used or the entities GroupMember role is used,
 * then the default type's user permissions and entities "User" role, and the same with visitor ("Visitor" role, etc).
 * @param privilegeManager
 * @param actor
 * @param operation
 * @param entity
 * @param specialContext
 */
export async function standardPermissionChecker(privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

    const operations = privilegeManager.operationTree.expandOperation(operation);
    const entityType = entityMetaDataLookup.findMetaData(entity)
    const isVisitor = !actor.id
    const entityRoles = await privilegeManager.getRolesForUserId(actor.id, entity)
    const isJustUser = !isVisitor && !entityRoles.length
    const isGroupMember = actor.groups.reduce((a, c) => a || entity.permissionGroupIds?.includes(c), false)

    for (let op of operations) {
        if (isAllowed(op))
            return true
    }
    if (entity.permissionSuper) {
        return privilegeManager.isAllowed(actor, operation, await entity.permissionSuper(), specialContext)
    }
    return false

    function isAllowed(op: Operation): boolean {
        for (let role of entityRoles)
            if (role.operations.has(op))
                return true

        if (isGroupMember)
            if (entityType.defaultGroupMemberPermissions.has(op) || entityRoles['GroupMember']?.operations.has(op))
                return true

        if (isJustUser || isVisitor)
            if (entityType.defaultUserPermissions.has(op) || entityRoles['User']?.operations.has(op))
                return true

        if (isVisitor) {
            if (entityType.defaultVisitorPermissions.has(op) || entityRoles['Visitor']?.operations.has(op))
                return true
        }

        return false

    }


}

////////////////////////////////////////////


/**
 * This class's purpose is to holds the operation definition tree and provide the expandOperation method
 */
class OperationTree {

    private parentsMap = new Map<Operation, Operation[]>()

    constructor(private tree: object) {

        this.processTree(tree)
    }

    private processTree(tree: object, parents: object[] = []) {

        const self = this
        populate(tree)

        function populate(node, parents: string[] = [],) {
            for (let [name, children] of Object.entries(node)) {
                const entryParents = self.parentsMap.get(name) || []
                self.parentsMap.set(name, entryParents.concat(parents))
                children && Object.keys(children).length && populate(children, [name, ...parents])
            }
        }
    }

    /**
     * expand to include the super-operations
     * @param operation
     */
    expandOperation(operation: Operation): Operation[] {

        if (!operation)
            return []
        const parents = this.parentsMap.get(operation)
        if (parents.length)
            return [operation, ...parents]
        return [operation, ...parents,
            ...parents.reduce((a, c) => {
                a.push(...this.expandOperation(c))
                return a
            }, [])]
    }

    find(operation: Operation): boolean {
        return this.parentsMap.has(operation);
    }
}

/**
 * with that, sophisticated permission schemes can easily be defined per entity-types.
 */
export class PermissionsMetaData {

    roles: { [roleName: string]: Role } = {}

    constructor(public name: string, parentNames: string[] = [],
                roles: Role[] = [],
                public defaultVisitorPermissions?: Set<Operation>,
                public defaultUserPermissions?: Set<Operation>,
                public defaultGroupMemberPermissions?: Set<Operation>
    ) {
        this.roles = roles.reduce((a, c) => {
            a[c.roleName] = c
            return a
        }, {})
    }
}

const entityMetaDataLookup = {

    metaDataMap: new Map<string, PermissionsMetaData>(),

    getOrAddMetaData(entityType: string | Function): PermissionsMetaData {
        const name = typeof entityType == 'string' ? entityType : entityType.name
        const clazz = typeof entityType == 'string' ? null : entityType

        let metadata = this.metaDataMap.get(name)
        if (!metadata) {
            // @ts-ignore
            metadata = clazz?.permissionsMetaData || new PermissionsMetaData(name)
            this.metaDataMap.set(name, metadata)
        }

        return metadata
    },

    findMetaData(entity: IPrivilegeManaged) {
        return this.getOrAddMetaData(entity.constructor || entity.___name)
    }
}

/**
 * Role defines the set of permitted operations. Each role is applicable to a provided entity types
 */
export class Role {

    readonly operations: Set<Operation>


    constructor(pm: PrivilegeManager, readonly roleName: string, operations: string[], ...entityTypes: (string | Function)[]) {
        this.operations = new Set<Operation>(operations);
        [...entityTypes].forEach(type => {
            const metaData = entityMetaDataLookup.getOrAddMetaData(type);
            metaData.roles[this.roleName] = this
            pm.saveRole( metaData.name, this)
        })

    }
}


export class MemoryPermissionStore implements IPermissionStore {
    private roleAssignmentDatabase: { [entityId: string]: { [actorId: string]: string[] } } = {}
    private roleRegistry = {};

    assignRole(entityId: any, actorId: any, roleName: string): Promise<void> {
        entityId = entityId.toString()
        actorId = actorId.toString()
        let entityEntry = this.roleAssignmentDatabase[entityId]
        if (!entityEntry) {
            entityEntry = {[actorId]: [roleName]}
            this.roleAssignmentDatabase[entityId] = entityEntry
            return
        }
        let actorRoles = entityEntry[actorId]
        if (!actorRoles) {
            entityEntry[actorId] = [roleName]
            return
        }
        actorRoles.push(roleName)
        return
    }

    async getRolesForUser(actorId: any, entity: IPrivilegeManaged): Promise<Role[]> {
        const entityId = entity.id.toString()
        actorId = actorId.toString()
        let entry = this.roleAssignmentDatabase[entityId]
        if (!entry)
            return []
        const roleNames = entry[actorId]
        if (!roleNames)
            return []

        return roleNames.map(rName => entityMetaDataLookup.findMetaData(entity).roles[rName])
    }

    async removeRole(entity: IPrivilegeManaged, actorId: any, roleName: string): Promise<void> {
        const entityId = entity.id.toString()
        actorId = actorId.toString()
        let entry = this.roleAssignmentDatabase[entityId]
        if (!entry)
            return
        const roleNames = entry[actorId]
        if (!roleNames)
            return
        const i = roleNames.indexOf(roleName)
        if (i === -1)
            return
        roleNames.splice(i, 1)
    }

    deleteRole(roleName: string, entityTypeName: string) {
        delete this.roleRegistry[entityTypeName + '.' + roleName]
    }

    async saveRole(entityTypeName:string, role: Role): Promise<void> {
        this.roleRegistry[entityTypeName + '.' + role.roleName] = role
    }

}

