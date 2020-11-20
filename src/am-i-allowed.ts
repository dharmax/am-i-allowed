/**
 * Special terms:
 *
 * - Visitor: a not logged-in user
 * - User: a logged-in user, with an account
 * - Group Memeber: a user which is in the group of the entity
 *
 */


export interface IActor {
    id
}

export interface IPrivilegeManaged {
    customPermissionChecker?: PermissionChecker;
    typeHierarchy: () => string[]
    id
}

export type PermissionChecker = (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) => Promise<boolean>

export type Operation = string

export abstract class IPermissionStore {
    abstract addRole(entityId: any, actorId: any, roleName: string):Promise<void>
    abstract removeRole(entityId: any, actorId: any, roleName: string):Promise<void>
    abstract getRolesForUser(actorId: any, entityId: any)
}

export class PrivilegeManager {

    readonly operationTree: OperationTree

    constructor(private store: IPermissionStore, operationsPlugin = (operationTree) => operationTree) {
        this.operationTree = new OperationTree(operationsPlugin(DefaultOperationsTreeScheme))
    }

    async test(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<void> {
        // @ts-ignore
        const isAllowed = await checkPermissionSoft(...arguments)
        if (!isAllowed) { // @ts-ignore
            throw new NoPrivilegeException(...arguments)
        }
    }

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
        return this.store.addRole(entity.id, actor?.id || actor, role.roleName)
    }

    async getRolesForUserId(id: any, entity: IPrivilegeManaged) {
        return this.store.getRolesForUser(id, entity.id)
    }
}


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


export async function standardPermissionChecker(privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

    const operations = privilegeManager.operationTree.expandOperation(operation);

    const actorRoles = await privilegeManager.getRolesForUserId(actor?.id, entity)


    let hasPermission = await privilegeManager.queryPermissions(actor, entity, operations)

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

        const parents = this.parentsMap.get(operation)
        if (!parents.length)
            return []
        return [...parents,
            ...parents.reduce((a, c) => {
                a.push(...this.expandOperation(c))
                return a
            }, [])]
    }

    find(operation: Operation): boolean {
        return this.parentsMap.has(operation);
    }
}

class EntityType {

    parents = new Set<EntityType>()
    roles = new Set<Role>()
    defaultVisitorPermissions = new Set<Operation>()
    defaultUserPermissions = new Set<Operation>()
    defaultGroupMemberPermissions = new Set<Operation>()

    constructor(public name: string, parentNames: string[], roles?: Role[]) {
        this.roles = new Set<Role>(roles)
        parentNames.forEach(parentName => {
            this.parents.add(entityTypesLookup.getOrAddType(parentName))
        })
    }
}

const entityTypesLookup = {

    typesMap: new Map<string, EntityType>(),

    getOrAddType(name, ...parents: string[]): EntityType {
        let entry = this.typesMap.get(name)
        if (!entry) {
            entry = new EntityType(name, parents)
        }
        return entry
    }

}

export class Role {

    readonly operations: Set<Operation>

    /**
     * Define a new role.
     * @param roleName name of role
     * @param entityTypes The entity types this role is applicable to
     * @param operations the operation the role holder may do on the entities of the aforementioned types
     */
    constructor(readonly roleName: string, entityTypes: string | string[], operations: string[]) {
        this.operations = new Set<Operation>(operations);
        [...entityTypes].forEach(typeName => entityTypesLookup.getOrAddType(typeName).roles.add(this))
    }
}

