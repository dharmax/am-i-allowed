"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const chai_1 = require("chai");
// lets define a class for Workshop and define access control policy....
class Workshop {
    constructor(id) {
        this.id = id;
    }
}
// this is the access-control policy:
Workshop.permissionsMetaData = new src_1.PermissionsMetaData('Workshop', {
    // everyone may buy or order stuff...
    defaultUserPermissions: ['Buy', 'Order'],
    // and let's not hide anything from the IRS people....
    groupPermissions: { IRS: 'ReadDeep' }
});
// now, this special workshop, works only on certain hours....
class SpecialWorkshop extends Workshop {
    constructor(id, orderHour) {
        super(id);
        this.orderHour = orderHour;
    }
}
// let's define a costume permission checker that checks the time of day in the process
SpecialWorkshop.customPermissionChecker = async (privilegeManager, actor, operation, entity, specialContext) => {
    const workshop = entity; // just for better type checking...
    if (workshop.orderHour !== 'All day') {
        if (isMorning() !== (workshop.orderHour === 'Morning'))
            return false; // no point to check further if the workshop is closed
    }
    // otherwise, check permissions normally....
    return src_1.standardPermissionChecker(privilegeManager, actor, operation, entity, specialContext);
};
describe('Testing am-i-allowed ', () => {
    // let's emulate a simple user database....
    const myUsers = {
        Jeff: { id: '1', groups: 'workers' },
        Shay: { id: '2', groups: 'admin' },
        customer1: { id: '3', groups: ['customers'] } // yes, you can provide an array and even an async function
    };
    // lets emulate a workshops database....
    const myEntities = {
        Workshop: new Workshop('12'),
        MorningWorkshop: new SpecialWorkshop('13', 'Morning'),
    };
    // lets represent our system administration aspect here....
    const sysAdmin = {
        ___name: 'System',
        id: 'System',
        permissionGroupIds: 'admin',
        permissionsMetaData: new src_1.PermissionsMetaData('System', {
            // let's give all users that belong to the admin, Admin privileges
            defaultGroupMemberPermissions: new Set(['Admin'])
        })
    };
    // this would be our access control manager, set to work with the simplistic memory backend
    const pm = new src_1.PrivilegeManager(new src_1.MemoryPermissionStore());
    // now, let's add a Seller role....
    const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop);
    // now let's test it!
    it('should be able to assign roles, groups, check privileges', async () => {
        // those are our workshops...
        const workShop1 = myEntities['Workshop'];
        const morningWorkshop = myEntities['MorningWorkshop'];
        // and those are the actors....
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay'];
        const customer = myUsers['customer1'];
        const IRSMan = { id: 'irs1', groups: 'IRS' };
        // let's assign a specific role to Jeff, our sales person
        await pm.assignRole(workShop1, jeff, RoleSalesPerson);
        chai_1.expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        chai_1.expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        chai_1.expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;
        chai_1.expect(await pm.isAllowed(jeff, 'Buy', workShop1)).to.be.true;
        chai_1.expect(await pm.isAllowed(customer, 'Order', workShop1)).to.be.true;
        // lets check our custom permission logic
        chai_1.expect(await pm.isAllowed(customer, 'Order', morningWorkshop)).to.be.equal(isMorning());
        // let's see: a customer shouldn't be able to deep-read, but IRS representative should...
        chai_1.expect(await pm.isAllowed(customer, 'ReadDeep', workShop1)).to.be.false;
        chai_1.expect(await pm.isAllowed(IRSMan, 'ReadDeep', workShop1)).to.be.true;
        // extracting roles
        chai_1.expect(await pm.getRolesForActor(jeff, workShop1)).to.be.lengthOf(1);
        console.log(await pm.getRolesForActor(jeff, workShop1));
    });
});
function isMorning(time) {
    const hour = (time || new Date()).getHours();
    return hour < 12 && hour > 6;
}
//# sourceMappingURL=basic-tests.spec.js.map