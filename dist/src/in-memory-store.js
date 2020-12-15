"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryPermissionStore = void 0;
class MemoryPermissionStore {
    constructor() {
        this.roleAssignmentDatabase = {};
        this.roleRegistry = {};
    }
    async assignRole(_entity, _actor, roleName) {
        const entityId = _entity.id.toString();
        const actor = _actor.id.toString();
        let entityEntry = this.roleAssignmentDatabase[entityId];
        if (!entityEntry) {
            entityEntry = { [actor]: [roleName] };
            this.roleAssignmentDatabase[entityId] = entityEntry;
            return;
        }
        let actorRoles = entityEntry[actor];
        if (!actorRoles) {
            entityEntry[actor] = [roleName];
            return;
        }
        actorRoles.push(roleName);
    }
    async getRolesForUser(_actor, entity, metadata) {
        const entityId = entity.id.toString();
        const actorId = _actor.id.toString();
        let entry = this.roleAssignmentDatabase[entityId];
        if (!entry)
            return [];
        const roleNames = entry[actorId];
        if (!roleNames)
            return [];
        return roleNames.map(rName => metadata.roles[rName]);
    }
    async removeRole(entity, _actor, roleName) {
        const entityId = entity.id.toString();
        const actorId = _actor.id.toString();
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
    async getActorRoles(_actor, skip, limit) {
        const actorId = _actor.id.toString();
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