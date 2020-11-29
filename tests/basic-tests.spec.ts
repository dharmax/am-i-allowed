import {before} from "mocha";
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


class Workshop implements IPrivilegeManaged {
    constructor(readonly id: string) {
    }

    static permissionsMetaData = new PermissionsMetaData('Workshop',{
        defaultUserPermissions: new Set(['Buy','Order'])
    })

}

class SpecialWorkshop extends Workshop {

    constructor( id:string, public orderHour: 'Morning' | 'Afternoon' | 'All day') {
        super(id);
    }
    static customPermissionChecker = async (privilegeManager: PrivilegeManager, actor: IActor, operation: Operation, entity: IPrivilegeManaged, specialContext?: any): Promise<boolean> =>{
        // @ts-ignore
        const normalResponse = await standardPermissionChecker(...arguments)
        // no point to check further
        if ( !normalResponse)
            return false

        const workshop = entity as SpecialWorkshop

        if (workshop.orderHour ==='All day' || !['Order', 'Buy'].includes(operation) )
            return  true

        return  isMorning() && workshop.orderHour === 'Morning'

    }
}

describe('Testing am-i-allowed ', () => {

    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: ['workers']},
        Shay: {id: '2', groups: ['admin']},
        customer1: {id:'3',  groups:['customers']}
    }
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop('12'),
        MorningWorkshop: new SpecialWorkshop('13', 'Morning'),
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
        const morningWorkshop = myEntities['MorningWorkshop'];
        const jeff = myUsers['Jeff'];
        const shai = myUsers['Shay']
        const sysAdmin = myEntities['sysAdmin']
        const customer = myUsers['customer1']

        await pm.assignRole(workShop1, jeff, RoleSalesPerson)

        expect(await pm.isAllowed(jeff, 'ReadDeep', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'ReadCommon', workShop1)).to.be.true;
        expect(await pm.isAllowed(jeff, 'WriteAnything', workShop1)).to.be.false;
        expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
        expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;

        expect(await pm.isAllowed(jeff, 'Buy', workShop1)).to.be.true;
        expect(await pm.isAllowed(customer, 'Order', workShop1)).to.be.true;
        expect(await pm.isAllowed(customer, 'Order', morningWorkshop)).to.be.equal(isMorning());

        expect( await pm.getRolesForActor( jeff.id, workShop1 )).to.be.lengthOf(1)
        console.log( await pm.getRolesForActor( jeff.id, workShop1 ))


    })
})

function isMorning() {
    const hour = (new Date()).getHours()
    return hour < 12  && hour > 6
}