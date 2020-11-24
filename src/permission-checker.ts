import {IActor, IPrivilegeManaged, Operation} from "./types";
import {PrivilegeManager} from "./am-i-allowed";

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
    const entityType = privilegeManager.findMetaData(entity)
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