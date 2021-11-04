import {IActor, IPermissionStore, IPrivilegeManaged, PermissionsMetaData} from "./types";
import {Role} from "./am-i-allowed";

import mongoose from "mongoose";

function extractReference(obj: object, path: string): any {
	return path.split(".").reduce((o, i) => o[i], obj);
}

// TODO: refactor model types as a mongoose model so it is better supported

export class MongoPermissionStore implements IPermissionStore {
    // private roleAssignmentDatabase: { [entityId: string]: { [actorId: string]: string[] } } = {}
    private roleRegistry = {};

	private model: any; 
	private path: string;
	private groupPath: string;

	private async fetchUser(id): Promise<any> {
		// user fetch
		// new mongoose.Types.ObjectId(id) <- this is not used since we are using
		return await this.model.findById(id);
	}

	private async proc(_actor: IActor, _entity: IPrivilegeManaged): Promise<{
		user: any,
		roles: Array<string>
	}> {
		const entityId = _entity.id.toString();
        const actor = _actor.id.toString();

		// user fetch
		const user = await this.fetchUser(actor);

		// resolve field
		const pmHolder = extractReference(user, this.path);
		if (pmHolder[entityId] === undefined) {
			// The user does not have a field for IPrivilegeManaged, so we create one
			pmHolder[entityId] = [];
			// mark as modified for saving
			user.markModified(this.path);
		}

		return {
			user,
			roles: pmHolder[entityId]
		}
	}

	static ToIActor(path): (user) => IActor {
		return user => {
			return {
				id: user._id,
				groups: extractReference(user, path)
			}
		}
	}

	constructor(model, path: string) {
		this.model = model;
		this.path = path;
	}

    async assignRole(_entity: IPrivilegeManaged, _actor: IActor, roleName: string): Promise<void> {
		const { user, roles } = await this.proc(_actor, _entity);
        roles.push(roleName);
		await user.save();
		return;
    }

    async getRolesForUser(_actor: IActor, entity: IPrivilegeManaged, metadata: PermissionsMetaData): Promise<Role[]> {
		const { roles } = await this.proc(_actor, entity);
        return roles.map(name => metadata.roles[name])
    }

    async removeRole(entity: IPrivilegeManaged, _actor: IActor, roleName: string): Promise<void> {
		const { roles } = await this.proc(_actor, entity);
        const i = roles.indexOf(roleName)
        if (i === -1)
            return
        roles.splice(i, 1)
    }

	// The two functions below don't really have a database implementation
    deleteRole(roleName: string, entityTypeName: string) {
        delete this.roleRegistry[entityTypeName + '.' + roleName]
    }

    async saveRole(entityTypeName: string, role: Role): Promise<void> {
        this.roleRegistry[entityTypeName + '.' + role.roleName] = role
    }

    async getRoleOwners(_entity: IPrivilegeManaged): Promise<{ [actorId: string]: string[] }> {
		// This query is going to be slow, but it's not a problem for now
        // return this.roleAssignmentDatabase[entity.id.toString()]
		const entityId = _entity.id.toString();
		const users = await this.model.find({
			[this.path]: {
				// we need to find 0th element
				// because if 0th element exists, it means the array length
				// is longer than 0
				$exists: entityId
			}
		});
		const returnObj : {
			[actorId: string]: string[]
		} = {}
		for (const user of users) {
			const roles = extractReference(user, this.path)[entityId]
			returnObj[user.id] = roles
		}
		return returnObj;
    }

    async getActorRoles(_actor: IActor, skip: number, limit: number): Promise<{ [p: string]: string[] }> {
		// user fetch
		const user = await this.fetchUser(_actor.id.toString());
		const holder = extractReference(user, this.path);

		return holder;
    }

}