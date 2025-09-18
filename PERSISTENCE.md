# Persistence Guide

This library treats persistence as a pluggable concern exposed through the `IPermissionStore` abstraction. The default `MemoryPermissionStore` is convenient for demos and unit tests, but production deployments must provide a durable implementation. This guide describes the contract, outlines recommended data models, and offers patterns for building a store backed by a database or external service.

## Contract Overview
An `IPermissionStore` implementation must provide the following capabilities:
- **Role lifecycle**: Persist roles per entity type via `saveRole` and `deleteRole`, and load them back into memory when requested by `PrivilegeManager`.
- **Assignments**: Store and remove role assignments linking actors to entity instances (`assignRole`, `removeRole`).
- **Query surfaces**: Answer `getRolesForUser`, `getRoleOwners`, and `getActorRoles` efficiently enough for hot-path authorization checks. All methods return Promises and should be safe for concurrent calls.

Each API receives fully hydrated objects (`IPrivilegeManaged`, `IActor`) or primitive identifiers. Implementations may normalise these values (e.g., convert to strings) before hitting the database. Whenever possible, ensure errors propagate rather than being swallowed; `PrivilegeManager` expects failures to reach the caller.

## Data Modelling Patterns
A minimal relational schema requires two tables/collections:
- `roles` keyed by `(entity_type, role_name)` containing the permitted operations and optional metadata blob.
- `role_assignments` keyed by `(entity_id, actor_id)` with an array of role names. Index on `(actor_id)` and `(entity_id)` to support the query methods.

Document databases can mirror this layout with two collections. Be mindful of storage format for the operation list—serialise to arrays of strings and rehydrate into `Set<Operation>` inside `saveRole`/`getRolesForUser`.

## Implementation Checklist
1. **Normalise identifiers**: Convert `entity.id` and `actor.id` to the canonical database key (usually strings) at the top of each method.
2. **Atomic writes**: Wrap `assignRole`/`removeRole` in transactions or use atomic update operators (e.g., `$addToSet` / `$pull` in MongoDB) to avoid race conditions.
3. **Caching strategies**: Cache role definitions per entity type if your database lookups are expensive. Invalidate the cache inside `saveRole` and `deleteRole`.
4. **Pagination semantics**: Honour the `skip`/`limit` arguments in `getActorRoles` to support incremental dashboards or admin APIs.
5. **Error surfaces**: Throw descriptive errors when operations fail (e.g., database connectivity) so callers can decide on retry logic.

## Example Outline (MongoDB)
```ts
class MongoPermissionStore extends IPermissionStore {
  constructor(private readonly roles: Collection, private readonly assignments: Collection) { super(); }

  async assignRole(entity: IPrivilegeManaged, actor: IActor, roleName: string) {
    await this.assignments.updateOne(
      { entityId: entity.id.toString(), actorId: actor.id.toString() },
      { $addToSet: { roles: roleName } },
      { upsert: true }
    );
  }

  async getRolesForUser(actor: IActor, entity: IPrivilegeManaged, metadata: PermissionsMetaData) {
    const doc = await this.assignments.findOne({ entityId: entity.id.toString(), actorId: actor.id.toString() });
    const roleNames = doc?.roles ?? [];
    return roleNames.map(name => metadata.roles[name]).filter(Boolean);
  }

  // Implement the remaining methods following the same patterns.
}
```
This example omits connection management, caching, and error handling; integrate those according to your infrastructure standards.

## Testing and Validation
- Reuse the existing Mocha suite and add integration tests that boot your `IPermissionStore` against an ephemeral database (e.g., Dockerised Postgres).
- Exercise conflict scenarios: concurrent `assignRole` calls, removals while permissions are queried, and deletion of roles still in use.
- Run soak tests in a staging environment to validate latency and throughput, especially for `getRolesForUser`, which sits on the request path.

## Maintenance Tips
- Log every structural change to roles and assignments; these are security-critical events.
- Track schema migrations and treat the permission store as part of your audit surface.
- Periodically prune stale role assignments to keep query responses fast.
- When evolving the operations taxonomy, plan migrations that update stored roles before deploying new code paths.
