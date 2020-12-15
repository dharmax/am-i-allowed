import {IActor, IPermissionStore, IPrivilegeManaged, PermissionsMetaData} from "./types";
import {Role} from "./am-i-allowed";

export class MemoryPermissionStore implements IPermissionStore {
    private roleAssignmentDatabase: { [entityId: string]: { [actorId: string]: string[] } } = {}
    private roleRegistry = {};

    async assignRole(_entity: IPrivilegeManaged, _actor: IActor, roleName: string): Promise<void> {
        const entityId = _entity.id.toString()
        const actor = _actor.id.toString()
        let entityEntry = this.roleAssignmentDatabase[entityId]
        if (!entityEntry) {
            entityEntry = {[actor]: [roleName]}
            this.roleAssignmentDatabase[entityId] = entityEntry
            return
        }
        let actorRoles = entityEntry[actor]
        if (!actorRoles) {
            entityEntry[actor] = [roleName]
            return
        }
        actorRoles.push(roleName)
    }

    async getRolesForUser(_actor: IActor, entity: IPrivilegeManaged, metadata: PermissionsMetaData): Promise<Role[]> {
        const entityId = entity.id.toString()
        const actorId = _actor.id.toString()
        let entry = this.roleAssignmentDatabase[entityId]
        if (!entry)
            return []
        const roleNames = entry[actorId]
        if (!roleNames)
            return []

        return roleNames.map(rName => metadata.roles[rName])
    }

    async removeRole(entity: IPrivilegeManaged, _actor: IActor, roleName: string): Promise<void> {
        const entityId = entity.id.toString()
        const actorId = _actor.id.toString()
        let entry = this.roleAssignmentDatabase[entityId]
        if (!entry)
            return
        const roleNames = entry[actorId]
        if (!roleNames)
            return
        const i = roleNames.indexOf(roleName)
        if (i === -1)
            return
        roleNames.splice(i, 1)
    }

    deleteRole(roleName: string, entityTypeName: string) {
        delete this.roleRegistry[entityTypeName + '.' + roleName]
    }

    async saveRole(entityTypeName: string, role: Role): Promise<void> {
        this.roleRegistry[entityTypeName + '.' + role.roleName] = role
    }

    async getRoleOwners(entity: IPrivilegeManaged): Promise<{ [actorId: string]: string[] }> {
        return this.roleAssignmentDatabase[entity.id]
    }

    async getActorRoles(_actor: IActor, skip: number, limit: number): Promise<{ [p: string]: string[] }> {

        const actorId = _actor.id.toString()
        const entries: { [entityId: string]: string[] } = {}
        let counter = 0
        for (let [e, assignments] of Object.entries(this.roleAssignmentDatabase)) {
            if (counter < skip)
                continue
            if (counter >= limit)
                break
            const actorAssignments = assignments[actorId];
            if (actorAssignments) {
                entries[e] = actorAssignments
            }
        }
        return entries
    }

}