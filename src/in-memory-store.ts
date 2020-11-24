import {IPermissionStore, IPrivilegeManaged, PermissionsMetaData} from "./types";
import {Role} from "./am-i-allowed";

export class MemoryPermissionStore implements IPermissionStore {
    private roleAssignmentDatabase: { [entityId: string]: { [actorId: string]: string[] } } = {}
    private roleRegistry = {};

    async assignRole(entityId: any, actorId: any, roleName: string): Promise<void> {
        entityId = entityId.toString()
        actorId = actorId.toString()
        let entityEntry = this.roleAssignmentDatabase[entityId]
        if (!entityEntry) {
            entityEntry = {[actorId]: [roleName]}
            this.roleAssignmentDatabase[entityId] = entityEntry
            return
        }
        let actorRoles = entityEntry[actorId]
        if (!actorRoles) {
            entityEntry[actorId] = [roleName]
            return
        }
        actorRoles.push(roleName)
    }

    async getRolesForUser(actorId: any, entity: IPrivilegeManaged, metadata: PermissionsMetaData): Promise<Role[]> {
        const entityId = entity.id.toString()
        actorId = actorId.toString()
        let entry = this.roleAssignmentDatabase[entityId]
        if (!entry)
            return []
        const roleNames = entry[actorId]
        if (!roleNames)
            return []

        return roleNames.map(rName => metadata.roles[rName])
    }

    async removeRole(entity: IPrivilegeManaged, actorId: any, roleName: string): Promise<void> {
        const entityId = entity.id.toString()
        actorId = actorId.toString()
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

}