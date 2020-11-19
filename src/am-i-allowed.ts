interface IActor {
    id
}

interface IPrivilegeManaged {
    customPermissionChecker?: PermissionChecker;
    id

}



export type PermissionChecker = (actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) => Promise<boolean>

export type Operation = string


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



}

////////////////////////////////////////////

async function globalPermissionCheck(actor: IActor, operation: Operation, specialContext: any): Promise<boolean> {
    return false;
}

