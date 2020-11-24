import {before} from "mocha";
import {PrivilegeManager} from "../src/am-i-allowed";
import {expect} from 'chai'
import {IActor, IPrivilegeManaged, Operation, PermissionsMetaData} from "../src/types";
import {MemoryPermissionStore} from "../src/in-memory-store";


class Workshop implements IPrivilegeManaged {
    constructor(readonly id: string) {

    }

    static permissionsMetaData = new PermissionsMetaData('Workshop',{})

}

describe('Testing am-i-allowed ', () => {

    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: ['workers']},
        Shay: {id: '2', groups: ['admin']}
    }
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop('12'),
        sysAdmin: {
            ___name: 'System',
            id: 'System',
            permissionGroupIds: ['admin'],
            permissionsMetaData: new PermissionsMetaData('System', {
                defaultGroupMemberPermissions: new Set<Operation>(['Admin'])
            })
        }

    }

    let pm = new PrivilegeManager(new MemoryPermissionStore())

    const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop)


    before(() => {
    })


    it('should be able to assign role', async () => {


        const workShop1 = myEntities['Workshop'];
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay']
        const sysAdmin = myEntities['sysAdmin']
        await pm.assignRole(workShop1, jeff, RoleSalesPerson)

        expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;

    })
})

