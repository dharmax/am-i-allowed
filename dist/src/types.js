"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsMetaData = exports.IPermissionStore = void 0;
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
    constructor(name, { defaultVisitorPermissions = new Set(), parentNames = [], defaultUserPermissions = new Set(), defaultGroupMemberPermissions = new Set() }) {
        this.name = name;
        // internally populated in the role definition process
        this.roles = {};
        this.parentNames = parentNames;
        this.defaultVisitorPermissions = defaultVisitorPermissions;
        this.defaultUserPermissions = defaultUserPermissions;
        this.defaultGroupMemberPermissions = defaultGroupMemberPermissions;
    }
}
exports.PermissionsMetaData = PermissionsMetaData;
//# sourceMappingURL=types.js.map