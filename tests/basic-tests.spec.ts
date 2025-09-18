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

const createManager = (transformer?: (tree: object) => object) => new PrivilegeManager(new MemoryPermissionStore(), transformer)

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

    it('inherits permissions through permissionSuper chains', async () => {
        const localPm = createManager()

        class RootEntity implements IPrivilegeManaged {
            constructor(public id: string) {}

            static permissionsMetaData = new PermissionsMetaData('RootEntity', {
                defaultUserPermissions: ['ReadCommon']
            })
        }

        class ChildEntity implements IPrivilegeManaged {
            constructor(public id: string, private readonly parent: RootEntity) {}

            static permissionsMetaData = new PermissionsMetaData('ChildEntity', {
                groupMembershipMandatory: true
            })

            permissionSuper = async () => this.parent
        }

        const parent = new RootEntity('root-1')
        const child = new ChildEntity('child-1', parent)
        const user: IActor = {id: 'user-1'}

        expect(await localPm.isAllowed(user, 'ReadCommon', child)).to.be.true
    })

    it('enforces group membership when mandatory', async () => {
        const localPm = createManager()

        class RestrictedEntity implements IPrivilegeManaged {
            constructor(public id: string, public permissionGroupIds = ['core-team']) {}

            static permissionsMetaData = new PermissionsMetaData('RestrictedEntity', {
                defaultUserPermissions: ['ReadCommon'],
                groupMembershipMandatory: true
            })
        }

        const entity = new RestrictedEntity('restricted-1')
        const outsider: IActor = {id: 'outsider'}
        const insider: IActor = {id: 'insider', groups: ['core-team']}

        expect(await localPm.isAllowed(outsider, 'ReadCommon', entity)).to.be.false
        expect(await localPm.isAllowed(insider, 'ReadCommon', entity)).to.be.true
    })

    it('allows custom permission checkers to short-circuit access', async () => {
        const localPm = createManager()

        class FeatureFlaggedEntity implements IPrivilegeManaged {
            constructor(public id: string) {}

            static permissionsMetaData = new PermissionsMetaData('FeatureFlaggedEntity', {
                defaultUserPermissions: ['ReadCommon']
            })

            static customPermissionChecker: typeof standardPermissionChecker = async (privilegeManager, actor, operation, entity, context?: {featureEnabled?: boolean}) => {
                if (context?.featureEnabled === false)
                    return false
                return standardPermissionChecker(privilegeManager, actor, operation, entity, context)
            }
        }

        const entity = new FeatureFlaggedEntity('feature-1')
        const actor: IActor = {id: 'flag-user'}

        expect(await localPm.isAllowed(actor, 'ReadCommon', entity, {featureEnabled: true})).to.be.true
        expect(await localPm.isAllowed(actor, 'ReadCommon', entity, {featureEnabled: false})).to.be.false
    })

    it('fails fast when metadata references unknown operations', async () => {
        const localPm = createManager()

        class MisconfiguredEntity implements IPrivilegeManaged {
            constructor(public id: string) {}

            static permissionsMetaData = new PermissionsMetaData('MisconfiguredEntity', {
                defaultUserPermissions: ['TotallyUnknownOp']
            })
        }

        const actor: IActor = {id: 'user-ops'}
        const entity = new MisconfiguredEntity('bad-1')

        try {
            await localPm.isAllowed(actor, 'ReadCommon', entity)
            expect.fail('Expected taxonomy validation failure')
        } catch (err) {
            expect((err as Error).message).to.include('Operation "TotallyUnknownOp" is not in the taxonomy')
        }
    })

    it('supports extending the operations taxonomy per manager', async () => {
        const customPm = createManager(defaultTree => ({
            ...defaultTree,
            Audit: {
                ViewAudit: {},
                EditAudit: {}
            }
        }))

        class AuditLog implements IPrivilegeManaged {
            constructor(public id: string) {}

            static permissionsMetaData = new PermissionsMetaData('AuditLog', {
                defaultUserPermissions: ['ViewAudit']
            })
        }

        const entity = new AuditLog('audit-1')
        const auditor: IActor = {id: 'auditor'}

        expect(await customPm.isAllowed(auditor, 'ViewAudit', entity)).to.be.true
        const expanded = customPm.operationTree.expandOperation('ViewAudit')
        expect(expanded).to.include('Audit')
    })
})

function isMorning(time?: Date) {
    const hour = (time || new Date()).getHours()
    return hour < 12 && hour > 6
}
