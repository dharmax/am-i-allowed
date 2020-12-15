"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const src_1 = require("../src");
const chai_1 = require("chai");
class Workshop {
    constructor(id) {
        this.id = id;
    }
}
Workshop.permissionsMetaData = new src_1.PermissionsMetaData('Workshop', {
    defaultUserPermissions: new Set(['Buy', 'Order'])
});
class SpecialWorkshop extends Workshop {
    constructor(id, orderHour) {
        super(id);
        this.orderHour = orderHour;
    }
}
SpecialWorkshop.customPermissionChecker = async (privilegeManager, actor, operation, entity, specialContext) => {
    // @ts-ignore
    const normalResponse = await src_1.standardPermissionChecker(...arguments);
    // no point to check further
    if (!normalResponse)
        return false;
    const workshop = entity;
    if (workshop.orderHour === 'All day' || !['Order', 'Buy'].includes(operation))
        return true;
    return isMorning() && workshop.orderHour === 'Morning';
};
describe('Testing am-i-allowed ', () => {
    const myUsers = {
        Jeff: { id: '1', groups: ['workers'] },
        Shay: { id: '2', groups: ['admin'] },
        customer1: { id: '3', groups: ['customers'] }
    };
    const myEntities = {
        Workshop: new Workshop('12'),
        MorningWorkshop: new SpecialWorkshop('13', 'Morning'),
        sysAdmin: {
            ___name: 'System',
            id: 'System',
            permissionGroupIds: ['admin'],
            permissionsMetaData: new src_1.PermissionsMetaData('System', {
                defaultGroupMemberPermissions: new Set(['Admin'])
            })
        }
    };
    let pm = new src_1.PrivilegeManager(new src_1.MemoryPermissionStore());
    const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop);
    mocha_1.before(() => {
    });
    it('should be able to assign role', async () => {
        const workShop1 = myEntities['Workshop'];
        const morningWorkshop = myEntities['MorningWorkshop'];
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay'];
        const sysAdmin = myEntities['sysAdmin'];
        const customer = myUsers['customer1'];
        await pm.assignRole(workShop1, jeff, RoleSalesPerson);
        chai_1.expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        chai_1.expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;
        chai_1.expect(await pm.isAllowed(jeff, 'Buy', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(customer, 'Order', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(customer, 'Order', morningWorkshop)).to.be.equal(isMorning());
        chai_1.expect(await pm.getRolesForActor(jeff, workShop1)).to.be.lengthOf(1);
        console.log(await pm.getRolesForActor(jeff, workShop1));
    });
});
function isMorning() {
    const hour = (new Date()).getHours();
    return hour < 12 && hour > 6;
}
//# sourceMappingURL=basic-tests.spec.js.map