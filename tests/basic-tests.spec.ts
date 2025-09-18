import {
    IActor,
    IPrivilegeManaged,
    MemoryPermissionStore,
    Operation,
    PermissionsMetaData,
    PrivilegeManager,
    standardPermissionChecker
} from "../src";
import {expect} from 'chai'


// lets define a class for Workshop and define access control policy....
class Workshop implements IPrivilegeManaged {

    constructor(readonly id: string) {
    }

    // this is the access-control policy:
    static permissionsMetaData = new PermissionsMetaData('Workshop', {
        // everyone may buy or order stuff...
        defaultUserPermissions: ['Buy', 'Order'],
        // and let's not hide anything from the IRS people....
        groupPermissions: {IRS: 'ReadDeep'}
    })

}

// now, this special workshop, works only on certain hours....
class SpecialWorkshop extends Workshop {

    constructor(id: string, public orderHour: 'Morning' | 'Afternoon' | 'All day') {
        super(id);
    }

    // let's define a costume permission checker that checks the time of day in the process
    static customPermissionChecker = async (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> => {

        const workshop = entity as SpecialWorkshop // just for better type checking...

        if (workshop.orderHour !== 'All day') {
            if (isMorning() !== (workshop.orderHour === 'Morning'))
                return false // no point to check further if the workshop is closed
        }

        // otherwise, check permissions normally....
        return standardPermissionChecker(privilegeManager, actor, operation, entity, specialContext)

    }
}

describe('Testing am-i-allowed ', () => {

    // let's emulate a simple user database....
    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: 'workers'},
        Shay: {id: '2', groups: 'admin'},
        customer1: {id: '3', groups: ['customers']} // yes, you can provide an array and even an async function
    }

    // lets emulate a workshops database....
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop('12'),
        MorningWorkshop: new SpecialWorkshop('13', 'Morning'),
    }

    // lets represent our system administration aspect here....
    const sysAdmin = {
        ___name: 'System', // an optional display name
        id: 'System',  // an ID
        permissionGroupIds: 'admin', // we'll set it as part of the admin group
        permissionsMetaData: new PermissionsMetaData('System', {
            // let's give all users that belong to the admin, Admin privileges
            defaultGroupMemberPermissions: new Set<Operation>(['Admin'])
        })
    }

    // this would be our access control manager, set to work with the simplistic memory backend
const pm = new PrivilegeManager(new MemoryPermissionStore())

    // now, let's add a Seller role....
    const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop)

    // now let's test it!
    it('should be able to assign roles, groups, check privileges', async () => {

        // those are our workshops...
        const workShop1 = myEntities['Workshop'];
        const morningWorkshop = myEntities['MorningWorkshop'];

        // and those are the actors....
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay']
        const customer = myUsers['customer1']
        const IRSMan = {id: 'irs1', groups: 'IRS'}

        // let's assign a specific role to Jeff, our sales person
        await pm.assignRole(workShop1, jeff, RoleSalesPerson)

        expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;

        expect(await pm.isAllowed(jeff, 'Buy', workShop1)).to.be.true;
        expect(await pm.isAllowed(customer, 'Order', workShop1)).to.be.true;

        // lets check our custom permission logic
        expect(await pm.isAllowed(customer, 'Order', morningWorkshop)).to.be.equal(isMorning());

        // let's see: a customer shouldn't be able to deep-read, but IRS representative should...
        expect(await pm.isAllowed(customer, 'ReadDeep', workShop1)).to.be.false
        expect(await pm.isAllowed(IRSMan, 'ReadDeep', workShop1)).to.be.true

        // extracting roles
        expect(await pm.getRolesForActor(jeff, workShop1)).to.be.lengthOf(1)

    })

    it('supports async metadata factories and custom group resolvers', async () => {
        class AsyncEntity implements IPrivilegeManaged {
            constructor(public id: string) {}

            static permissionsMetaData = async () => new PermissionsMetaData('AsyncEntity', {
                defaultUserPermissions: ['ReadCommon']
            })

            permissionGroupIds = async () => ['async-group']
        }

        const entity = new AsyncEntity('async-1')
        const actor: IActor = {id: '42', groups: () => Promise.resolve('async-group')}

        expect(await pm.isAllowed(actor, 'ReadCommon', entity)).to.be.true
        expect(await pm.isAllowed(actor, 'ReadDeep', entity)).to.be.false
    })

    it('throws when checking undefined operations', () => {
        const actor: IActor = {id: '404'}
        const entity: IPrivilegeManaged = {id: 'resource'}

        expect(() => pm.isAllowed(actor, 'NonExistingOperation', entity)).to.throw('Operation NonExistingOperation is not defined')
    })

    it('expands operations up the taxonomy tree', () => {
        const operations = pm.operationTree.expandOperation('ReadCommon')
        expect(operations).to.include('ReadCommon')
        expect(operations).to.include('ReadAnything')
        expect(operations).to.include('Admin')
    })

    it('retrieves actor roles using string identifiers and pagination', async () => {
        class Document implements IPrivilegeManaged {
            constructor(public id: string) {}
        }

        const docA = new Document('docA')
        const docB = new Document('docB')
        const reviewerRole = pm.addRole('Reviewer', ['ReadCommon'], Document)

        const reviewer: IActor = {id: '9000'}
        await pm.assignRole(docA, reviewer, reviewerRole)
        await pm.assignRole(docB, reviewer, reviewerRole)

        const allRoles = await pm.getActorRoles('9000')
        expect(Object.keys(allRoles)).to.have.lengthOf(2)

        const limitedRoles = await pm.getActorRoles('9000', 1, 1)
        expect(Object.keys(limitedRoles)).to.have.lengthOf(1)
    })
})

function isMorning(time?: Date) {
    const hour = (time || new Date()).getHours()
    return hour < 12 && hour > 6
}
