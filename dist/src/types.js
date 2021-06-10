"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUP_ROLE_PREFIX = exports.PermissionsMetaData = exports.IPermissionStore = void 0;
/**
 * You can use anything as the persistent storage for the permission system, as long as it is compatible with this interface
 */
class IPermissionStore {
}
exports.IPermissionStore = IPermissionStore;
/**
 * with that, sophisticated permission schemes can easily be defined per entity-types.
 */
class PermissionsMetaData {
    constructor(name, { defaultVisitorPermissions = new Set(), parentNames = [], defaultUserPermissions = new Set(), defaultGroupMemberPermissions = new Set(), groupMembershipMandatory = false, groupPermissions = {} }) {
        this.name = name;
        // internally populated in the role definition process
        this.roles = {};
        this.parentNames = parentNames;
        this.defaultVisitorPermissions = toSet(defaultVisitorPermissions);
        this.defaultUserPermissions = toSet(defaultUserPermissions);
        this.groupMembershipMandatory = groupMembershipMandatory;
        this.defaultGroupMemberPermissions = toSet(defaultGroupMemberPermissions);
        this.groupPermissions = {};
        Object.entries(groupPermissions).forEach(e => this.groupPermissions[e[0]] = toSet(e[1]));
    }
}
exports.PermissionsMetaData = PermissionsMetaData;
exports.GROUP_ROLE_PREFIX = 'MemberOf';
function toSet(v) {
    if (v.constructor.name == 'Set')
        return v;
    if (Array.isArray(v))
        return new Set(v);
    return new Set([v]);
}
//# sourceMappingURL=types.js.map