import {before} from "mocha";
import {assignRole, checkPermissionSoft, IActor, IPrivilegeManaged, Role} from "../src/am-i-allowed";


describe('Testing am-i-allowed ', () => {

    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1'},
        Shay: {id: '2'}
    }
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: {
            typeHierarchy: ()=> ['Workshop'],
            id: '12'
        }
    }

    const RoleSalesPerson = new Role( 'Seller', 'Workshop', ['ReadDeep','Sell'])


    before(() => {

    })


    it('should be able to assign role', async () => {


        await assignRole(myEntities['Workshop'], myUsers['Jeff'], RoleSalesPerson)

        expect(checkPermissionSoft(my));

    })
})