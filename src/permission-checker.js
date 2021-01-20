"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardPermissionChecker = void 0;
const types_1 = require("./types");
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
const standardPermissionChecker = async (privilegeManager, actor, operation, entity, specialContext) => {
    const operations = privilegeManager.operationTree.expandOperation(operation);
    const metaData = await privilegeManager.findMetaData(entity);
    const entityRoles = await privilegeManager.getRolesForActor(actor, entity);
    const isVisitor = !actor.id;
    const isAUser = !isVisitor;
    const commonGroups = (actor === null || actor === void 0 ? void 0 : actor.groups.filter(g => { var _a; return (_a = entity.permissionGroupIds) === null || _a === void 0 ? void 0 : _a.includes(g); })) || [];
    const isGroupMember = (commonGroups === null || commonGroups === void 0 ? void 0 : commonGroups.length) > 0;
    if (!metaData.groupMembershipMandatory || isGroupMember)
        for (let op of operations) {
            if (isAllowed(op))
                return true;
        }
    if (entity.permissionSuper) {
        return privilegeManager.isAllowed(actor, operation, await entity.permissionSuper(), specialContext);
    }
    return false;
    function isAllowed(op) {
        var _a, _b, _c;
        for (let role of entityRoles)
            if (role.operations.has(op))
                return true;
        for (let group of commonGroups) {
            const groupMemberRole = metaData.roles[types_1.GROUP_ROLE_PREFIX + group];
            if (groupMemberRole && groupMemberRole.operations.has(op))
                return true;
        }
        if (isGroupMember)
            if (metaData.defaultGroupMemberPermissions.has(op) || ((_a = entityRoles['GroupMember']) === null || _a === void 0 ? void 0 : _a.operations.has(op)))
                return true;
        if (isAUser)
            if (metaData.defaultUserPermissions.has(op) || ((_b = entityRoles['User']) === null || _b === void 0 ? void 0 : _b.operations.has(op)))
                return true;
        if (isVisitor) {
            if (metaData.defaultVisitorPermissions.has(op) || ((_c = entityRoles['Visitor']) === null || _c === void 0 ? void 0 : _c.operations.has(op)))
                return true;
        }
        return false;
    }
};
exports.standardPermissionChecker = standardPermissionChecker;
//# sourceMappingURL=permission-checker.js.map