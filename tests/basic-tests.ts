import {before} from "mocha";
import {
    assignRole,
    checkPermissionSoft,
    IActor,
    IPrivilegeManaged,
    MemoryPermissionStore,
    PrivilegeManager,
    Role
} from "../src/am-i-allowed";


describe('Testing am-i-allowed ', () => {

    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: ['workers']},
        Shay: {id: '2', groups: ['admin']}
    }
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop( '12')
        }
    }

    let pm = new PrivilegeManager( new MemoryPermissionStore())

    const RoleSalesPerson = new Role( 'Seller', 'Workshop', ['ReadDeep','Sell'])


    before(() => {

    })


    it('should be able to assign role', async () => {


        await assignRole(myEntities['Workshop'], myUsers['Jeff'], RoleSalesPerson)

        expect(checkPermissionSoft(my));

    })
})


class Workshop implements IPrivilegeManaged{
    constructor(readonly id: string) {

    }

    entityType(): PrivilegeManagedEntityType {
        return undefined;
    }

    permissionGroupIds: string[];

}