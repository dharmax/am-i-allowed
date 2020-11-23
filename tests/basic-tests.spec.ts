import {before} from "mocha";
import {
    IActor,
    IPrivilegeManaged,
    MemoryPermissionStore,
    PrivilegeManager,
    Role
} from "../src/am-i-allowed";
import {expect} from 'chai'


class Workshop implements IPrivilegeManaged {
    constructor(readonly id: string) {

    }

    permissionGroupIds: string[];

}
describe('Testing am-i-allowed ', () => {

    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: ['workers']},
        Shay: {id: '2', groups: ['admin']}
    }
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop('12')

    }

    let pm = new PrivilegeManager(new MemoryPermissionStore())

    const RoleSalesPerson = new Role('Seller', ['ReadDeep', 'Sell'], Workshop)


    before(() => {

    })


    it('should be able to assign role', async () => {


        const workShop1 = myEntities['Workshop'];
        const jeff = myUsers['Jeff'];
        await pm.assignRole(workShop1, jeff, RoleSalesPerson)

        expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'Write', workShop1)).to.be.false;

    })
})

