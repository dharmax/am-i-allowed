"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryPermissionStore = void 0;
class MemoryPermissionStore {
    constructor() {
        this.roleAssignmentDatabase = {};
        this.roleRegistry = {};
    }
    async assignRole(entityId, actorId, roleName) {
        entityId = entityId.toString();
        actorId = actorId.toString();
        let entityEntry = this.roleAssignmentDatabase[entityId];
        if (!entityEntry) {
            entityEntry = { [actorId]: [roleName] };
            this.roleAssignmentDatabase[entityId] = entityEntry;
            return;
        }
        let actorRoles = entityEntry[actorId];
        if (!actorRoles) {
            entityEntry[actorId] = [roleName];
            return;
        }
        actorRoles.push(roleName);
    }
    async getRolesForUser(actorId, entity, metadata) {
        const entityId = entity.id.toString();
        actorId = actorId.toString();
        let entry = this.roleAssignmentDatabase[entityId];
        if (!entry)
            return [];
        const roleNames = entry[actorId];
        if (!roleNames)
            return [];
        return roleNames.map(rName => metadata.roles[rName]);
    }
    async removeRole(entity, actorId, roleName) {
        const entityId = entity.id.toString();
        actorId = actorId.toString();
        let entry = this.roleAssignmentDatabase[entityId];
        if (!entry)
            return;
        const roleNames = entry[actorId];
        if (!roleNames)
            return;
        const i = roleNames.indexOf(roleName);
        if (i === -1)
            return;
        roleNames.splice(i, 1);
    }
    deleteRole(roleName, entityTypeName) {
        delete this.roleRegistry[entityTypeName + '.' + roleName];
    }
    async saveRole(entityTypeName, role) {
        this.roleRegistry[entityTypeName + '.' + role.roleName] = role;
    }
    async getRoleOwners(entity) {
        return this.roleAssignmentDatabase[entity.id];
    }
    async getActorRoles(actorId, skip, limit) {
        const entries = {};
        let counter = 0;
        for (let [e, assignments] of Object.entries(this.roleAssignmentDatabase)) {
            if (counter < skip)
                continue;
            if (counter >= limit)
                break;
            const actorAssignments = assignments[actorId];
            if (actorAssignments) {
                entries[e] = actorAssignments;
            }
        }
        return entries;
    }
}
exports.MemoryPermissionStore = MemoryPermissionStore;
//# sourceMappingURL=in-memory-store.js.map