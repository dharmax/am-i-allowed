interface IActor {
    id
}

interface IPrivilegeManaged {
    customPermissionChecker?: PermissionChecker;
    id

}


export type PermissionChecker = (actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) => Promise<boolean>

export type Operation = string


export function initPrivilegeManager(operationsPlugin = (operationTree) => operationTree) {
    operationTree = new OperationTree(operationsPlugin(DefaultOperationsTreeScheme))
}

let operationTree: OperationTree
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
                    GenericAction: {}
                },
                Join: {},
                Disable: {
                    Suspend: {
                        Warn: {},
                        Flag: {}
                    }
                },
                Delete: {
                    EditAll: {
                        WriteAll: {
                            ReadAll: {
                                ReadDeep: {
                                    ReadShallow: {
                                        ReadHeadline: {}
                                    },
                                },
                            }
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


export async function checkPermissionSoft(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

    if (!entity)
        return globalPermissionCheck(actor, operation, specialContext)

    if (entity.customPermissionChecker)
        // @ts-ignore
        return entity.customPermissionChecker(...arguments)
    // @ts-ignore
    return standardPermissionChecker(...arguments)
}

class NoPrivilegeException extends Error {
    constructor(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) {
        super(`${actor.id} attempted unprivileged operation ${operation.toString()} on ${entity.id}`)
    }

    message: string;
    name: string;
}

export async function checkPermission(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<void> {
    // @ts-ignore
    const isAllowed = await checkPermissionSoft(...arguments)
    if (!isAllowed) { // @ts-ignore
        throw new NoPrivilegeException(...arguments)
    }
}

export async function standardPermissionChecker(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> {

    const operations = operationTree.expandOperation(operation);

    const actorRoles = await getUserRoles(actor, entity)


    let hasPermission = await privilegeStorage.queryPermissions(actor, entity, operations)

}

////////////////////////////////////////////

async function globalPermissionCheck(actor: IActor, operation: Operation, specialContext: any): Promise<boolean> {
    return false;
}


class OperationTree {

    private parentsMap: { [operationName: string]: string[] } = {}

    constructor(private tree: object) {

        this.processTree(tree)
    }

    private processTree(tree: object, parents: object[] = []) {

        const self = this
        populate(tree)

        function populate(node, parents = [],) {
            for (let [name, children] of Object.entries(node)) {
                self.parentsMap[name] = parents
                children && Object.keys(children).length && populate(children, [name, ...parents])
            }
        }
    }

    /**
     * expand to include the super-operations
     * @param operation
     */
    expandOperation(operation): Operation[] {

        const parents = operation.getParents()
        if (!parents.length)
            return []
        return [...parents,
            ...parents.reduce((a, c) => {
                a.push(...this.expandOperation(c))
                return a
            }, [])]
    }
}