import {IActor, Identifier, IPermissionStore, IPrivilegeManaged, Operation, PermissionChecker, PermissionsMetaData} from "./types";
import {standardPermissionChecker} from "./permission-checker";
import {DefaultOperationsTaxonomy} from "./operations-taxonomy";

type PermissionAwareConstructor = Function & {
    customPermissionChecker?: PermissionChecker;
    permissionsMetaData?: PermissionsMetaData | (() => PermissionsMetaData | Promise<PermissionsMetaData>);
    name?: string;
};

/**
 * This is the main class. Normally you'd need just one PrivilegeManager for the whole application.
 * Use it to check permissions.
 *
 * * Special terms:
 *
 * The relation between ac actor to a given entity may be one of the following:
 * - Visitor: a not logged-in user
 * - User: a logged-in user, with an account
 * - Group Member: a user that shares the group of the entity
 * - a role owner: there's a role explicitly assigned to the use on the entity
 *
 */
export class PrivilegeManager {

    readonly operationTree: OperationTree
    private entityMetaDataLookup: EntityMetaDataLookup;

    /**
     * Builds a privilege manager instance.
     * @param store the persistence backend for the permission storage
     * @param operationsTransformer an optional operation tree transformer, in case you wish to alter the default one, add more operations, etc
     */
    constructor(public store: IPermissionStore, operationsTransformer = (operationTree) => operationTree) {
        this.operationTree = new OperationTree(operationsTransformer(DefaultOperationsTaxonomy))
        this.entityMetaDataLookup = new EntityMetaDataLookup(this)
    }

    /**
     * Check for if the actor is allowed to do something and throws an exception if he isn't
     * @param actor
     * @param operation
     * @param entity
     * @param specialContext for custom logic
     * @throws NoPrivilegeException if actor is not allowed
     */
    async test(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: unknown): Promise<void> {
        const isAllowed = await this.isAllowed(actor, operation, entity, specialContext)
        if (!isAllowed) {
            throw new NoPrivilegeException(actor, operation, entity, specialContext)
        }
    }

    /**
     * Check if the actor is allowed to do
     * @param actor
     * @param operation
     * @param entity
     * @param specialContext
     * @return <promise> of true or false
     */
    isAllowed(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: unknown): Promise<boolean> {

        if (!this.operationTree.find(operation))
            throw new Error(`Operation ${operation.toString()} is not defined. Consider adding it to the operations tree.`)

        const entityCtor = entity.constructor as PermissionAwareConstructor | undefined
        const customPermissionChecker = entity.customPermissionChecker || entityCtor?.customPermissionChecker;
        if (customPermissionChecker)
            return customPermissionChecker(this, actor, operation, entity, specialContext)

        return standardPermissionChecker(this, actor, operation, entity, specialContext)
    }

    /**
     * @return all the actors that have explicit roles assigned on that entity
     * @param entity the entity
     */
    getRoleOwners(entity: IPrivilegeManaged): Promise<{ [p: string]: string[] }> {
        return this.store.getRoleOwners(entity)
    }

    /**
     * @return all the roles explicitly assigned to the actor on any entity
     * @param actorId
     * @param skip pagination support
     * @param limit pagination support
     */
    getActorRoles(actorId: Identifier, skip = 0, limit = 1000): Promise<{ [entityId: string]: string[] }> {
        return this.store.getActorRoles(actorId, skip, limit)
    }


    /**
     * assign a role to use in entity
     * @param entity the entity
     * @param actor either IActor or an id
     * @param role the role
     */
    assignRole(entity: IPrivilegeManaged, actor: IActor, role: Role): Promise<void> {
        return this.store.assignRole(entity, actor, role.roleName)
    }

    /**
     * @Return the roles the actor have on an entity
     * @param actor
     * @param entity
     */
    async getRolesForActor(actor: IActor, entity: IPrivilegeManaged): Promise<Role[]> {
        return this.store.getRolesForUser(actor, entity, await this.findMetaData(entity))
    }

    // noinspection JSIgnoredPromiseFromCall
    /**
     * Define a new role. Also add itself to the corresponding entityType. Y
     * @param roleName name of role
     * @param entityType The entity types this role is applicable to
     * @param operations the operation the role holder may do on the entities of the aforementioned types
     * @return the new role object
     */
    addRole(roleName: string, operations: Operation[], entityType: (string | Function)): Role {
        const role = new Role(this, roleName, operations, entityType)
        const metaData = this.getOrAddMetaData(entityType);
        metaData.roles[roleName] = role
        void this.store.saveRole(metaData.name, role)
        return role
    }

    /**
     * Define a new role. Also add itself to the corresponding entityType. You can add multiple roles, each for
     * different entity type if you provide more than one entity type.
     * @param roleName name of role
     * @param entityTypes The entity types this role is applicable to
     * @param operations the operation the role holder may do on the entities of the aforementioned types
     * @return the new roles objects
     */
    addRoles(roleName: string, operations: Operation[], ...entityTypes: (string | Function)[]): Role[] {
        return  entityTypes.map(entityType => this.addRole( roleName, operations, entityType ))
    }

    deleteRole(roleName: string, entityTypeName: string): Promise<void> {
        return this.store.deleteRole(roleName, entityTypeName)
    }

    async saveRole(entityTypeName: string, role: Role) {

        await this.store.saveRole(entityTypeName, role)
    }

    getOrAddMetaData(type: string | Function) {
        return this.entityMetaDataLookup.getOrAddMetaData(type)
    }

    async findMetaData(entity: IPrivilegeManaged) {
        return this.entityMetaDataLookup.findMetaData(entity)
    }
}


export class NoPrivilegeException extends Error {
    constructor(actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any) {
        super(`${actor.id} attempted unprivileged operation ${operation.toString()} on ${entity.id} with ${JSON.stringify(specialContext || '')}`)
    }

    message: string;
    name: string;
}

////////////////////////////////////////////


/**
 * This class's purpose is to holds the operation definition tree and provide the expandOperation method
 */
class OperationTree {

    private parentsMap = new Map<Operation, Operation[]>()

    constructor(private tree: object) {
        this.processTree(tree)
    }

    private processTree(tree: object) {

        const self = this
        populate(tree)

        function populate(node, parents: string[] = [],) {
            for (let [name, children] of Object.entries(node)) {
                const entryParents = self.parentsMap.get(name) || []
                self.parentsMap.set(name, entryParents.concat(parents))
                children && Object.keys(children).length && populate(children, [name, ...parents])
            }
        }
    }

    /**
     * expand to include the super-operations
     * @param operation
     */
    expandOperation(operation: Operation): Operation[] {

        if (!operation)
            return []
        const parents = this.parentsMap.get(operation) ?? []
        if (!parents.length)
            return [operation]
        const expandedParents = parents.flatMap(parent => this.expandOperation(parent))
        return [operation, ...new Set([...parents, ...expandedParents])]
    }

    find(operation: Operation): boolean {
        return this.parentsMap.has(operation);
    }
}


class EntityMetaDataLookup {

    metaDataMap = new Map<string, PermissionsMetaData>()

    constructor(private privilegeManager: PrivilegeManager) {
    }

    getOrAddMetaData(entityType: string | Function): PermissionsMetaData {
        const name = typeof entityType == 'string' ? entityType : entityType.name
        const clazz = typeof entityType == 'string' ? null : entityType

        let metadata = this.metaDataMap.get(name)
        if (!metadata) {
            // @ts-ignore
            metadata = clazz?.permissionsMetaData || new PermissionsMetaData(name, {})
            this.metaDataMap.set(name, metadata)
        }

        return metadata
    }

    async findMetaData(entity: IPrivilegeManaged): Promise<PermissionsMetaData> {
        // first, we check if there's meta data on the entity itself
        const entityCtor = entity.constructor as PermissionAwareConstructor | undefined
        let metaData = entity.permissionsMetaData || entityCtor?.permissionsMetaData
        if (!metaData) {
            const entityName = entityCtor === Object ? entity.___name : entityCtor?.name;
            return this.getOrAddMetaData(entityName)
        }

        // if it is defined as function - execute the function
        metaData = typeof metaData === 'function' ? await metaData() : metaData

        if (!(metaData instanceof PermissionsMetaData))
            throw new Error(`permissionsMetaData for ${entityCtor?.name || entity.___name} must resolve to PermissionsMetaData`)

        // validate the metadata if it wasn't validated before
        if (!metaData._validated)
            metaData._validated = this.validateMetaData(metaData)

        return metaData
    }

    private validateMetaData(md: PermissionsMetaData) {
        [...md.defaultGroupMemberPermissions, ...md.defaultUserPermissions, ...md.defaultVisitorPermissions].forEach(
            o => {
                if (!this.privilegeManager.operationTree.find(o))
                    throw new Error(`Operation "${o}" is not in the taxonomy`)
            })
        return true;
    }
}

/**
 * Role defines the set of permitted operations. Each role is applicable to a provided entity types
 */
export class Role {

    readonly operations: Set<Operation>

    constructor(_pm: PrivilegeManager, readonly roleName: string, operations: Operation[], readonly entityType: (string | Function)) {
        this.operations = new Set<Operation>(operations);
    }
}
