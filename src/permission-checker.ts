import {GROUP_ROLE_PREFIX, IActor, IPrivilegeManaged, Operation, PermissionChecker} from "./types";
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
export const standardPermissionChecker: PermissionChecker = async (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> => {

    const operations = privilegeManager.operationTree.expandOperation(operation);
    const metaData = await privilegeManager.findMetaData(entity)
    const entityRoles = await privilegeManager.getRolesForActor(actor, entity)
    const isVisitor = !actor.id
    const isAUser = !isVisitor
    const commonGroups = actor?.groups.filter(g => entity.permissionGroupIds?.includes(g)) || []
    const isGroupMember = commonGroups?.length > 0

    if (!metaData.groupMembershipMandatory || isGroupMember)
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

        for (let group of commonGroups) {
            const groupMemberRole = metaData.roles[GROUP_ROLE_PREFIX + group]
            if (groupMemberRole && groupMemberRole.operations.has(op))
                return true
        }

        if (isGroupMember)
            if (metaData.defaultGroupMemberPermissions.has(op) || entityRoles['GroupMember']?.operations.has(op))
                return true

        if (isAUser)
            if (metaData.defaultUserPermissions.has(op) || entityRoles['User']?.operations.has(op))
                return true

        if (isVisitor) {
            if (metaData.defaultVisitorPermissions.has(op) || entityRoles['Visitor']?.operations.has(op))
                return true
        }

        return false

    }


}