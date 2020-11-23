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
 * @permissionSuper is an optional support for things like group trees or folder trees, etc, where by default, a node's permission is derived from its parent, so you can
 * simply return the parent node.
 */
export interface IPrivilegeManaged {
    id
    permissionGroupIds?: string[]
    customPermissionChecker?: PermissionChecker
    entityType?: () => PrivilegeManagedEntityType // should be static !
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
        if (!entity)
            return globalPermissionCheck(this, actor, operation, specialContext)

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
 * This is the standardPermissionChecker logic.
 * @param privilegeManager
 * @param actor
 * @param operation
 * @param entity
 * @param specialContext
 */
export async function standardPermissionChecker(privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

    const operations = privilegeManager.operationTree.expandOperation(operation);
    const entityType = entityTypesLookup.findType(entity)
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
        if (isVisitor) {
            if (entityType.defaultVisitorPermissions.has(op) || entityRoles['Visitor']?.operations.has(op))
                return true
        }

        if (isJustUser)
            if (entityType.defaultUserPermissions.has(op) || entityRoles['Visitor']?.operations.has(op))
                return true
        if (isGroupMember)
            if (entityType.defaultGroupMemberPermissions.has(op) || entityRoles['GroupMember']?.operations.has(op))
                return true
        for (let role of entityRoles)
            if (role.operations.has(op))
                return true


        return false

    }


}

////////////////////////////////////////////

async function globalPermissionCheck(privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, specialContext: any): Promise<boolean> {
    return false;
}


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

    expandAll(operations: Iterable<Operation>): Set<Operation> {
        if (!operations)
            return new Set<Operation>()
        return Array.from(operations).reduce((a, c) => {
            this.expandOperation(c).forEach(o => a.add(o))
            return a
        }, new Set<Operation>())
    }

    find(operation: Operation): boolean {
        return this.parentsMap.has(operation);
    }
}

export class PrivilegeManagedEntityType {

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

const entityTypesLookup = {

    typesMap: new Map<string, PrivilegeManagedEntityType>(),

    getOrAddType(entityType: string | Function): PrivilegeManagedEntityType {
        const name = typeof entityType == 'string' ? entityType : entityType.name
        const clazz = typeof entityType == 'string' ? null : entityType

        let entry = this.typesMap.get(name)
        if (!entry) {
            // @ts-ignore
            entry = clazz?.entityType || new PrivilegeManagedEntityType(name)
            this.typesMap.set(name, entry)
        }

        return entry
    },

    findType(entity: IPrivilegeManaged) {
        const t = entity.entityType && entity.entityType()
        if (t)
            return t
        return this.getOrAddType(entity.constructor)
    }
}

export class Role {

    readonly operations: Set<Operation>

    /**
     * Define a new role. Also add itself to the corresponding entityType
     * @param roleName name of role
     * @param entityTypes The entity types this role is applicable to
     * @param operations the operation the role holder may do on the entities of the aforementioned types
     */
    constructor(readonly roleName: string, operations: string[], ...entityTypes: string[] | Function[]) {
        this.operations = new Set<Operation>(operations);
        [...entityTypes].forEach(type => entityTypesLookup.getOrAddType(type).roles[this.roleName] = this)
    }
}


export class MemoryPermissionStore implements IPermissionStore {
    private rolesDatabase: { [entityId: string]: { [actorId: string]: string[] } } = {}

    assignRole(entityId: any, actorId: any, roleName: string): Promise<void> {
        entityId = entityId.toString()
        actorId = actorId.toString()
        let entityEntry = this.rolesDatabase[entityId]
        if (!entityEntry) {
            entityEntry = {[actorId]: [roleName]}
            this.rolesDatabase[entityId] = entityEntry
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
        let entry = this.rolesDatabase[entityId]
        if (!entry)
            return []
        const roleNames = entry[actorId]
        if (!roleNames)
            return []

        return roleNames.map(rName => entityTypesLookup.findType(entity).roles[rName])
    }

    async removeRole(entity: IPrivilegeManaged, actorId: any, roleName: string): Promise<void> {
        const entityId = entity.id.toString()
        actorId = actorId.toString()
        let entry = this.rolesDatabase[entityId]
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

}

