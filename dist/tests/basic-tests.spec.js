"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const am_i_allowed_1 = require("../src/am-i-allowed");
const chai_1 = require("chai");
const src_1 = require("../src");
const src_2 = require("../src");
class Workshop {
    constructor(id) {
        this.id = id;
    }
}
Workshop.permissionsMetaData = new src_1.PermissionsMetaData('Workshop', {});
describe('Testing am-i-allowed ', () => {
    const myUsers = {
        Jeff: { id: '1', groups: ['workers'] },
        Shay: { id: '2', groups: ['admin'] }
    };
    const myEntities = {
        Workshop: new Workshop('12'),
        sysAdmin: {
            ___name: 'System',
            id: 'System',
            permissionGroupIds: ['admin'],
            permissionsMetaData: new src_1.PermissionsMetaData('System', {
                defaultGroupMemberPermissions: new Set(['Admin'])
            })
        }
    };
    let pm = new am_i_allowed_1.PrivilegeManager(new src_2.MemoryPermissionStore());
    const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop);
    mocha_1.before(() => {
    });
    it('should be able to assign role', async () => {
        const workShop1 = myEntities['Workshop'];
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay'];
        const sysAdmin = myEntities['sysAdmin'];
        await pm.assignRole(workShop1, jeff, RoleSalesPerson);
        chai_1.expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        chai_1.expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;
    });
});
//# sourceMappingURL=basic-tests.spec.js.map