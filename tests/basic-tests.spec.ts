import {
    IActor,
    IPrivilegeManaged,
    MemoryPermissionStore,
    Operation,
    PermissionsMetaData,
    PrivilegeManager,
    standardPermissionChecker
} from "../src";
import { MongoPermissionStore } from "../src/mongo-store";
import { IPermissionStore } from "../src/types";

import dotenv from "dotenv";

import {expect} from 'chai'

import mongoose from "mongoose";

dotenv.config();

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

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

describe('main', function () {

    // let's emulate a simple user database....
    const myUsers: { [name: string]: IActor } = {
        Jeff: {id: '1', groups: 'workers'},
        Shay: {id: '2', groups: 'admin'},
        customer1: {id: '3', groups: ['customers']}, // yes, you can provide an array and even an async function
        IRSMan: {id: 'irs1', groups: 'IRS'}
    }

    // lets emulate a workshops database....
    const myEntities: { [name: string]: IPrivilegeManaged } = {
        Workshop: new Workshop('12'),
        MorningWorkshop: new SpecialWorkshop('13', 'Morning'),
    }

    // lets represent our system administration aspect here....
    // TODO: provide a constructor interface for this
    const sysAdmin : IPrivilegeManaged = {
        ___name: 'System', // an optional display name
        id: 'System',  // an ID
        permissionGroupIds: 'admin', // we'll set it as part of the admin group
        permissionsMetaData: new PermissionsMetaData('System', {
            // let's give all users that belong to the admin, Admin privileges
            defaultGroupMemberPermissions: new Set<Operation>(['Admin'])
        }),
    }

    const stores: Array<IPermissionStore> = [];

    // those are our workshops...
    const workShop = myEntities['Workshop'];
    const morningWorkshop = myEntities['MorningWorkshop'];

    // initialize different store types
    stores.push(new MemoryPermissionStore());

    let dbinit;

    if (process.env.DB_URI) {
        const userSchema = new mongoose.Schema({
            _id: String, // Not conventional
            perms: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
            groups: [],
        }, { minimize: false });
        const toIActor = MongoPermissionStore.ToIActor("groups");
        userSchema.methods.getIActor = function () {
            return toIActor(this);
        }

        const User = mongoose.model("User", userSchema);
        dbinit = new Promise(async r => {
            await mongoose.connect(process.env.DB_URI, {
                // @ts-ignore
                useUnifiedTopology: true,
            })
            const creations = [];
            for (const [key, obj] of Object.entries(myUsers)) {
                const u = User.create({_id: obj.id, perms: {}, groups: obj.groups })
                creations.push(u);
            }
            await User.deleteMany({});
            await Promise.all(creations).catch(console.error);

            r(true);
        });
        
        const mongo = new MongoPermissionStore(User, "perms");
        // @ts-ignore
        mongo.resolve = (id) => User.findOne({ _id: id }).then(u => u.getIActor());
        stores.push(mongo);
    } else {
        console.log('No DB_URI, skipping MongoPermissionStore');
    }

    before(async function () {
        this.timeout(10000);
        await dbinit;
    });

    // matrix testing
    for (const store of stores) {
        // @ts-ignore
        describe(`Testing with permission store ${store.__proto__.constructor.toString().match(/class (\w+)/)[1]}`, () => {
            this.timeout(0);
            console.log('called')
            // and those are the actors....
            let jeff = myUsers['Jeff'];
            let shai = myUsers['Shay']
            let customer = myUsers['customer1']
            let IRSMan = myUsers['IRSMan']
            // @ts-ignore

            // this would be our access control manager, set to work with the simplistic memory backend
            const pm = new PrivilegeManager(store)
        
            // now, let's add a Seller role....
            const RoleSalesPerson = pm.addRole('Seller', ['ReadDeep', 'Sell'], Workshop)

            // now let's test it!
            it('should be able to assign roles, groups, check privileges', async function () {
                // this.timeout(0);
                // @ts-ignore
                if (store.resolve) {
                    // TODO: fix testing framework
                    // @ts-ignore
                    jeff = await store.resolve(jeff.id);
                    // @ts-ignore
                    shai = await store.resolve(shai.id);
                    // @ts-ignore
                    customer = await store.resolve(customer.id);
                    // @ts-ignore
                    IRSMan = await store.resolve(IRSMan.id);
                }

                // let's assign a specific role to Jeff, our sales person
                await pm.assignRole(workShop, jeff, RoleSalesPerson)
        
                expect(await pm.isAllowed(jeff, 'ReadDeep', workShop)).to.be.true;
                expect(await pm.isAllowed(jeff, 'ReadCommon', workShop)).to.be.true;
                expect(await pm.isAllowed(jeff, 'WriteAnything', workShop)).to.be.false;
                expect(await pm.isAllowed(shai, 'EditAnything', sysAdmin)).to.be.true;
                expect(await pm.isAllowed(jeff, 'EditAnything', sysAdmin)).to.be.false;
        
                expect(await pm.isAllowed(jeff, 'Buy', workShop)).to.be.true;
                expect(await pm.isAllowed(customer, 'Order', workShop)).to.be.true;
        
                // lets check our custom permission logic
                expect(await pm.isAllowed(customer, 'Order', morningWorkshop)).to.be.equal(isMorning());
        
                // let's see: a customer shouldn't be able to deep-read, but IRS representative should...
                expect(await pm.isAllowed(customer, 'ReadDeep', workShop)).to.be.false
                expect(await pm.isAllowed(IRSMan, 'ReadDeep', workShop)).to.be.true

                // extracting roles
                expect(await pm.getRolesForActor(jeff, workShop)).to.be.lengthOf(1)
                console.log('roles for actor Jeff', await pm.getRolesForActor(jeff, workShop))
        
            })
        })
    }

})

function isMorning(time?: Date) {
    const hour = (time || new Date()).getHours()
    return hour < 12 && hour > 6
}