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
    constructor(name, { defaultVisitorPermissions = new Set(), parentNames = [], defaultUserPermissions = new Set(), defaultGroupMemberPermissions = new Set(), groupMembershipMandatory = false }) {
        this.name = name;
        // internally populated in the role definition process
        this.roles = {};
        this.parentNames = parentNames;
        this.defaultVisitorPermissions = new Set([...defaultVisitorPermissions]);
        this.defaultUserPermissions = new Set([...defaultUserPermissions]);
        this.groupMembershipMandatory = groupMembershipMandatory;
        this.defaultGroupMemberPermissions = new Set([...defaultGroupMemberPermissions]);
    }
}
exports.PermissionsMetaData = PermissionsMetaData;
exports.GROUP_ROLE_PREFIX = 'MemberOf';
//# sourceMappingURL=types.js.map