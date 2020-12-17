/**
 * This structure defines the operations taxonomy. When a permission for a specific operation is given, it implicitly
 * denotes that its child operations are also permitted. The purpose of such a taxonomy is to save redundant coding and
 * confusing/illogical permission definitions.
 * The tree can be altered @see PrivilegeManager constructor
 */
export const DefaultOperationsTaxonomy = {
    Admin: {
        AddAdmin: {
            ChangePermissions: {
            }
        },
        DeleteDatabase: {
            ManageDatabase: {
                ManageUsers: {
                    SendMessage: {},
                }
            }
        },
        Manage: {
            PowerUser: {
                Execute: {
                    GenericAction: {},
                    Trade: {
                        AcceptPayment: {
                            Sell: {
                                Loan: {},
                                Rent: {}
                            },
                        },
                        Buy: {
                            Lease: {},
                            Pay: {},
                            Order: {}
                        },
                    },
                },
                Eject: {
                    Invite: {
                        Join: {
                            Leave: {}
                        },
                    }
                },
                Disable: {
                    Ban: {
                        Suspend: {
                            Warn: {},
                            Flag: {}
                        }
                    }
                },
                Delete: {
                    EditAnything: {
                        WriteAnything: {
                            WriteCommon: {
                                ReadCommon: {}
                            },
                            ReadAnything: {
                                ReadDeep: {
                                    ReadCommon: {
                                        ReadHeadline: {}
                                    },
                                }
                            },
                        },
                        AddStuff: {
                            Comment: {},
                            Rate: {
                                DownVote: {
                                    UpVote: {}
                                }
                            },
                            DetachItem: {
                                AttachItem: {}
                            }
                        }
                    }
                },
            }
        }
    }
}