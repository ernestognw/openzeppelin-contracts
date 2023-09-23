const { web3 } = require('hardhat');
const { constants, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expectRevertCustomError } = require('../../helpers/customError');
const { selector } = require('../../helpers/methods');
const { clockFromReceipt } = require('../../helpers/time');
const { buildBaseRoles, formatAccess, EXPIRATION, MINSETBACK } = require('../../helpers/access-manager');
const {
  // MODE HELPERS
  shouldBehaveLikeClosable,
  // DELAY HELPERS
  shouldBehaveLikeDelay,
  // METHOD HELPERS
  shouldBehaveLikeGetAccess,
  shouldBehaveLikeHasRole,
  shouldBehaveLikeCanCall,
  // ADMIN OPERATION HELPERS
  shouldBehaveLikeDelayedAdminOperation,
  shouldBehaveLikeNotDelayedAdminOperation,
  shouldBehaveLikeRoleAdminOperation,
  // RESTRICTED OPERATION HELPERS
  shouldBehaveLikeAManagedRestrictedOperation,
  shouldBehaveLikeSchedulableOperation,
  // HELPERS
  scheduleOperation,
} = require('./AccessManager.behavior');
const { default: Wallet } = require('ethereumjs-wallet');
const { mine } = require('@nomicfoundation/hardhat-network-helpers');

const AccessManager = artifacts.require('$AccessManager');
const AccessManagedTarget = artifacts.require('$AccessManagedTarget');
const Ownable = artifacts.require('$Ownable');

const BASE_ROLES = buildBaseRoles();

contract('AccessManager', function (accounts) {
  const [admin, manager, guardian, member, user, other] = accounts;

  // Add members
  BASE_ROLES.ADMIN.members = [admin];
  BASE_ROLES.SOME_ADMIN.members = [manager];
  BASE_ROLES.SOME_GUARDIAN.members = [guardian];
  BASE_ROLES.SOME.members = [member];
  BASE_ROLES.PUBLIC.members = [admin, manager, guardian, member, user, other];

  beforeEach(async function () {
    this.roles = BASE_ROLES;
    this.manager = await AccessManager.new(admin);
    this.target = await AccessManagedTarget.new(this.manager.address);

    for (const { id: roleId, admin, guardian, members } of Object.values(BASE_ROLES)) {
      if (roleId === this.roles.PUBLIC.id) continue; // Every address belong to public and is locked
      if (roleId === this.roles.ADMIN.id) continue; // Admin set during construction and is locked

      // Set admin role avoiding default
      if (admin.id !== this.roles.ADMIN.id) {
        await this.manager.$_setRoleAdmin(roleId, admin.id);
      }

      // Set guardian role avoiding default
      if (guardian.id !== this.roles.ADMIN.id) {
        await this.manager.$_setRoleGuardian(roleId, guardian.id);
      }

      // Grant role to members
      for (const member of members) {
        await this.manager.$_grantRole(roleId, member, 0, 0);
      }
    }
  });

  describe('during construction', function () {
    it('grants admin role to initialAdmin', async function () {
      const manager = await AccessManager.new(other);
      expect(await manager.hasRole(this.roles.ADMIN.id, other).then(formatAccess)).to.be.deep.equal([true, '0']);
    });

    it('rejects zero address for initialAdmin', async function () {
      await expectRevertCustomError(AccessManager.new(constants.ZERO_ADDRESS), 'AccessManagerInvalidInitialAdmin', [
        constants.ZERO_ADDRESS,
      ]);
    });

    it('initializes setup roles correctly', async function () {
      for (const { id: roleId, admin, guardian, members } of Object.values(BASE_ROLES)) {
        expect(await this.manager.getRoleAdmin(roleId)).to.be.bignumber.equal(admin.id);
        expect(await this.manager.getRoleGuardian(roleId)).to.be.bignumber.equal(guardian.id);

        const isMember = Object.fromEntries(members.map(member => [member, true]));

        for (const user of this.roles.PUBLIC.members) {
          expect(await this.manager.hasRole(roleId, user).then(formatAccess)).to.be.deep.equal([!!isMember[user], '0']);
        }
      }
    });
  });

  describe('getters', function () {
    describe('#canCall', function () {
      beforeEach('set calldata', function () {
        this.calldata = '0x1234';
        this.role = { id: web3.utils.toBN(379204) };
      });

      shouldBehaveLikeCanCall({
        closed: function () {
          it('should return false and no delay', async function () {
            const { immediate, delay } = await this.manager.canCall(
              Wallet.generate().getChecksumAddressString(),
              this.target.address,
              this.calldata.substring(0, 10),
            );
            expect(immediate).to.be.equal(false);
            expect(delay).to.be.bignumber.equal('0');
          });
        },
        open: {
          callerIsTheManager: {
            executing: function () {
              it('should return true and no delay', async function () {
                const { immediate, delay } = await this.manager.canCall(
                  this.caller,
                  this.target.address,
                  this.calldata.substring(0, 10),
                );
                expect(immediate).to.be.equal(true);
                expect(delay).to.be.bignumber.equal('0');
              });
            },
            notExecuting: function () {
              it('should return false and no delay', async function () {
                const { immediate, delay } = await this.manager.canCall(
                  this.caller,
                  this.target.address,
                  this.calldata.substring(0, 10),
                );
                expect(immediate).to.be.equal(false);
                expect(delay).to.be.bignumber.equal('0');
              });
            },
          },
          callerIsNotTheManager: {
            publicRoleIsRequired: function () {
              it('should return true and no delay', async function () {
                const { immediate, delay } = await this.manager.canCall(
                  this.caller,
                  this.target.address,
                  this.calldata.substring(0, 10),
                );
                expect(immediate).to.be.equal(true);
                expect(delay).to.be.bignumber.equal('0');
              });
            },
            specificRoleIsRequired: {
              requiredRoleIsGranted: {
                roleGrantingIsDelayed: {
                  callerHasAnExecutionDelay: {
                    before: function () {
                      beforeEach('consume previously set grant delay', async function () {
                        // Consume previously set delay
                        await mine();
                      });

                      it('should return false and no execution delay', async function () {
                        const { immediate, delay } = await this.manager.canCall(
                          this.caller,
                          this.target.address,
                          this.calldata.substring(0, 10),
                        );
                        expect(immediate).to.be.equal(false);
                        expect(delay).to.be.bignumber.equal('0');
                      });
                    },
                    after: function () {
                      beforeEach('consume previously set grant delay', async function () {
                        // Consume previously set delay
                        await mine();
                        this.scheduleIn = this.executionDelay;
                      });

                      shouldBehaveLikeSchedulableOperation({
                        scheduled: {
                          before: function () {
                            it('should return false and execution delay', async function () {
                              const { immediate, delay } = await this.manager.canCall(
                                this.caller,
                                this.target.address,
                                this.calldata.substring(0, 10),
                              );
                              expect(immediate).to.be.equal(false);
                              expect(delay).to.be.bignumber.equal(this.executionDelay);
                            });
                          },
                          after: function () {
                            it('should return false and execution delay', async function () {
                              const { immediate, delay } = await this.manager.canCall(
                                this.caller,
                                this.target.address,
                                this.calldata.substring(0, 10),
                              );
                              expect(immediate).to.be.equal(false);
                              expect(delay).to.be.bignumber.equal(this.executionDelay);
                            });
                          },
                          expired: function () {
                            it('should return false and execution delay', async function () {
                              const { immediate, delay } = await this.manager.canCall(
                                this.caller,
                                this.target.address,
                                this.calldata.substring(0, 10),
                              );
                              expect(immediate).to.be.equal(false);
                              expect(delay).to.be.bignumber.equal(this.executionDelay);
                            });
                          },
                        },
                        notScheduled: function () {
                          it('should return false and execution delay', async function () {
                            const { immediate, delay } = await this.manager.canCall(
                              this.caller,
                              this.target.address,
                              this.calldata.substring(0, 10),
                            );
                            expect(immediate).to.be.equal(false);
                            expect(delay).to.be.bignumber.equal(this.executionDelay);
                          });
                        },
                      });
                    },
                  },
                  callerHasNoExecutionDelay: {
                    before: function () {
                      beforeEach('consume previously set grant delay', async function () {
                        // Consume previously set delay
                        await mine();
                      });

                      it('should return false and no execution delay', async function () {
                        const { immediate, delay } = await this.manager.canCall(
                          this.caller,
                          this.target.address,
                          this.calldata.substring(0, 10),
                        );
                        expect(immediate).to.be.equal(false);
                        expect(delay).to.be.bignumber.equal('0');
                      });
                    },
                    after: function () {
                      beforeEach('consume previously set grant delay', async function () {
                        // Consume previously set delay
                        await mine();
                      });

                      it('should return true and no execution delay', async function () {
                        const { immediate, delay } = await this.manager.canCall(
                          this.caller,
                          this.target.address,
                          this.calldata.substring(0, 10),
                        );
                        expect(immediate).to.be.equal(true);
                        expect(delay).to.be.bignumber.equal('0');
                      });
                    },
                  },
                },
                roleGrantingIsNotDelayed: {
                  callerHasAnExecutionDelay: function () {
                    it('should return false and execution delay', async function () {
                      const { immediate, delay } = await this.manager.canCall(
                        this.caller,
                        this.target.address,
                        this.calldata.substring(0, 10),
                      );
                      expect(immediate).to.be.equal(false);
                      expect(delay).to.be.bignumber.equal(this.executionDelay);
                    });
                  },
                  callerHasNoExecutionDelay: function () {
                    it('should return true and no execution delay', async function () {
                      const { immediate, delay } = await this.manager.canCall(
                        this.caller,
                        this.target.address,
                        this.calldata.substring(0, 10),
                      );
                      expect(immediate).to.be.equal(true);
                      expect(delay).to.be.bignumber.equal('0');
                    });
                  },
                },
              },
              requiredRoleIsNotGranted: function () {
                it('should return false and no execution delay', async function () {
                  const { immediate, delay } = await this.manager.canCall(
                    this.caller,
                    this.target.address,
                    this.calldata.substring(0, 10),
                  );
                  expect(immediate).to.be.equal(false);
                  expect(delay).to.be.bignumber.equal('0');
                });
              },
            },
          },
        },
      });
    });

    describe('#expiration', function () {
      it('has a 7 days default expiration', async function () {
        expect(await this.manager.expiration()).to.be.bignumber.equal(EXPIRATION);
      });
    });

    describe('#minSetback', function () {
      it('has a 5 days default minimum setback', async function () {
        expect(await this.manager.minSetback()).to.be.bignumber.equal(MINSETBACK);
      });
    });

    describe('#isTargetClosed', function () {
      shouldBehaveLikeClosable({
        closed: function () {
          it('returns true', async function () {
            expect(await this.manager.isTargetClosed(this.target.address)).to.be.equal(true);
          });
        },
        open: function () {
          it('returns false', async function () {
            expect(await this.manager.isTargetClosed(this.target.address)).to.be.equal(false);
          });
        },
      });
    });

    describe('#getTargetFunctionRole', function () {
      const methodSelector = selector('something(address,bytes)');

      it('returns the target function role', async function () {
        const roleId = web3.utils.toBN(21498);
        await this.manager.$_setTargetFunctionRole(this.target.address, methodSelector, roleId);

        expect(await this.manager.getTargetFunctionRole(this.target.address, methodSelector)).to.be.bignumber.equal(
          roleId,
        );
      });

      it('returns the ADMIN role if not set', async function () {
        expect(await this.manager.getTargetFunctionRole(this.target.address, methodSelector)).to.be.bignumber.equal(
          this.roles.ADMIN.id,
        );
      });
    });

    describe('#getTargetAdminDelay', function () {
      describe('when the target admin delay is setup', function () {
        beforeEach('set target admin delay', async function () {
          this.oldDelay = await this.manager.getTargetAdminDelay(this.target.address);
          this.newDelay = time.duration.days(10);

          await this.manager.$_setTargetAdminDelay(this.target.address, this.newDelay);
          this.delay = MINSETBACK; // For shouldBehaveLikeDelay
        });

        shouldBehaveLikeDelay('effect', {
          before: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns the old target admin delay', async function () {
              expect(await this.manager.getTargetAdminDelay(this.target.address)).to.be.bignumber.equal(this.oldDelay);
            });
          },
          after: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns the new target admin delay', async function () {
              expect(await this.manager.getTargetAdminDelay(this.target.address)).to.be.bignumber.equal(this.newDelay);
            });
          },
        });
      });

      it('returns the 0 if not set', async function () {
        expect(await this.manager.getTargetAdminDelay(this.target.address)).to.be.bignumber.equal('0');
      });
    });

    describe('#getRoleAdmin', function () {
      const roleId = web3.utils.toBN(5234907);

      it('returns the role admin', async function () {
        const adminId = web3.utils.toBN(789433);

        await this.manager.$_setRoleAdmin(roleId, adminId);

        expect(await this.manager.getRoleAdmin(roleId)).to.be.bignumber.equal(adminId);
      });

      it('returns the ADMIN role if not set', async function () {
        expect(await this.manager.getRoleAdmin(roleId)).to.be.bignumber.equal(this.roles.ADMIN.id);
      });
    });

    describe('#getRoleGuardian', function () {
      const roleId = web3.utils.toBN(5234907);

      it('returns the role guardian', async function () {
        const guardianId = web3.utils.toBN(789433);

        await this.manager.$_setRoleGuardian(roleId, guardianId);

        expect(await this.manager.getRoleGuardian(roleId)).to.be.bignumber.equal(guardianId);
      });

      it('returns the ADMIN role if not set', async function () {
        expect(await this.manager.getRoleGuardian(roleId)).to.be.bignumber.equal(this.roles.ADMIN.id);
      });
    });

    describe('#getRoleGrantDelay', function () {
      const roleId = web3.utils.toBN(9248439);

      describe('when the grant admin delay is setup', function () {
        beforeEach('set grant admin delay', async function () {
          this.oldDelay = await this.manager.getRoleGrantDelay(roleId);
          this.newDelay = time.duration.days(11);

          await this.manager.$_setGrantDelay(roleId, this.newDelay);
          this.delay = MINSETBACK; // For shouldBehaveLikeDelay
        });

        shouldBehaveLikeDelay('grant', {
          before: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns the old role grant delay', async function () {
              expect(await this.manager.getRoleGrantDelay(roleId)).to.be.bignumber.equal(this.oldDelay);
            });
          },
          after: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns the new role grant delay', async function () {
              expect(await this.manager.getRoleGrantDelay(roleId)).to.be.bignumber.equal(this.newDelay);
            });
          },
        });
      });

      it('returns the 0 if not set', async function () {
        expect(await this.manager.getTargetAdminDelay(this.target.address)).to.be.bignumber.equal('0');
      });
    });

    describe('#getAccess', function () {
      beforeEach('set role', function () {
        this.role = { id: web3.utils.toBN(9452) };
        this.caller = user;
      });

      shouldBehaveLikeGetAccess({
        requiredRoleIsGranted: {
          roleGrantingIsDelayed: {
            callerHasAnExecutionDelay: {
              before: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('role is not in effect and execution delay is set', async function () {
                  const access = await this.manager.getAccess(this.role.id, this.caller);
                  expect(access[0]).to.be.bignumber.equal(this.delayEffect); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Not in effect yet
                  expect(await time.latest()).to.be.bignumber.lt(access[0]);
                });
              },
              after: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('access has role in effect and execution delay is set', async function () {
                  const access = await this.manager.getAccess(this.role.id, this.caller);

                  expect(access[0]).to.be.bignumber.equal(this.delayEffect); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Already in effect
                  expect(await time.latest()).to.be.bignumber.equal(access[0]);
                });
              },
            },
            callerHasNoExecutionDelay: {
              before: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('access has role not in effect without execution delay', async function () {
                  const access = await this.manager.getAccess(this.role.id, this.caller);
                  expect(access[0]).to.be.bignumber.equal(this.delayEffect); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Not in effect yet
                  expect(await time.latest()).to.be.bignumber.lt(access[0]);
                });
              },
              after: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('role is in effect without execution delay', async function () {
                  const access = await this.manager.getAccess(this.role.id, this.caller);
                  expect(access[0]).to.be.bignumber.equal(this.delayEffect); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Already in effect
                  expect(await time.latest()).to.be.bignumber.equal(access[0]);
                });
              },
            },
          },
          roleGrantingIsNotDelayed: {
            callerHasAnExecutionDelay: function () {
              it('access has role in effect and execution delay is set', async function () {
                const access = await this.manager.getAccess(this.role.id, this.caller);
                expect(access[0]).to.be.bignumber.equal(await time.latest()); // inEffectSince
                expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                // Already in effect
                expect(await time.latest()).to.be.bignumber.equal(access[0]);
              });
            },
            callerHasNoExecutionDelay: function () {
              it('access has role in effect without execution delay', async function () {
                const access = await this.manager.getAccess(this.role.id, this.caller);
                expect(access[0]).to.be.bignumber.equal(await time.latest()); // inEffectSince
                expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
                expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                // Already in effect
                expect(await time.latest()).to.be.bignumber.equal(access[0]);
              });
            },
          },
        },
        requiredRoleIsNotGranted: function () {
          it('has empty access', async function () {
            const access = await this.manager.getAccess(this.role.id, this.caller);
            expect(access[0]).to.be.bignumber.equal('0'); // inEffectSince
            expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
            expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
            expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect
          });
        },
      });
    });

    describe('#hasRole', function () {
      beforeEach('setup shouldBehaveLikeHasRole', function () {
        this.role = { id: web3.utils.toBN(49832) };
        this.calldata = '0x1234';
        this.caller = user;
      });

      shouldBehaveLikeHasRole({
        publicRoleIsRequired: function () {
          it('has PUBLIC role', async function () {
            const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
            expect(isMember).to.be.true;
            expect(executionDelay).to.be.bignumber.eq('0');
          });
        },
        specificRoleIsRequired: {
          requiredRoleIsGranted: {
            roleGrantingIsDelayed: {
              callerHasAnExecutionDelay: {
                before: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('does not have role but execution delay', async function () {
                    const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                    expect(isMember).to.be.false;
                    expect(executionDelay).to.be.bignumber.eq(this.executionDelay);
                  });
                },
                after: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('has role and execution delay', async function () {
                    const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                    expect(isMember).to.be.true;
                    expect(executionDelay).to.be.bignumber.eq(this.executionDelay);
                  });
                },
              },
              callerHasNoExecutionDelay: {
                before: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('does not have role nor execution delay', async function () {
                    const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                    expect(isMember).to.be.false;
                    expect(executionDelay).to.be.bignumber.eq('0');
                  });
                },
                after: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('has role and no execution delay', async function () {
                    const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                    expect(isMember).to.be.true;
                    expect(executionDelay).to.be.bignumber.eq('0');
                  });
                },
              },
            },
            roleGrantingIsNotDelayed: {
              callerHasAnExecutionDelay: function () {
                it('has role and execution delay', async function () {
                  const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                  expect(isMember).to.be.true;
                  expect(executionDelay).to.be.bignumber.eq(this.executionDelay);
                });
              },
              callerHasNoExecutionDelay: function () {
                it('has role and no execution delay', async function () {
                  const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
                  expect(isMember).to.be.true;
                  expect(executionDelay).to.be.bignumber.eq('0');
                });
              },
            },
          },
          requiredRoleIsNotGranted: function () {
            it('has no role and no execution delay', async function () {
              const { isMember, executionDelay } = await this.manager.hasRole(this.role.id, this.caller);
              expect(isMember).to.be.false;
              expect(executionDelay).to.be.bignumber.eq('0');
            });
          },
        },
      });
    });

    describe('#getSchedule', function () {
      beforeEach('set role and calldata', async function () {
        const method = 'fnRestricted()';
        this.caller = user;
        this.role = { id: web3.utils.toBN(493590) };
        await this.manager.$_setTargetFunctionRole(this.target.address, selector(method), this.role.id);
        await this.manager.$_grantRole(this.role.id, this.caller, 0, 0);

        this.calldata = await this.target.contract.methods[method]().encodeABI();
        this.scheduleIn = time.duration.days(10);
      });

      shouldBehaveLikeSchedulableOperation({
        scheduled: {
          before: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns schedule in the future', async function () {
              const schedule = await this.manager.getSchedule(this.operationId);
              expect(schedule).to.be.bignumber.equal(this.scheduledAt.add(this.scheduleIn));
              expect(schedule).to.be.bignumber.gt(await time.latest());
            });
          },
          after: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns schedule', async function () {
              const schedule = await this.manager.getSchedule(this.operationId);
              expect(schedule).to.be.bignumber.equal(this.scheduledAt.add(this.scheduleIn));
              expect(schedule).to.be.bignumber.eq(await time.latest());
            });
          },
          expired: function () {
            beforeEach('consume previously set grant delay', async function () {
              // Consume previously set delay
              await mine();
            });

            it('returns 0', async function () {
              expect(await this.manager.getSchedule(this.operationId)).to.be.bignumber.equal('0');
            });
          },
        },
        notScheduled: function () {
          it('defaults to 0', async function () {
            expect(await this.manager.getSchedule(this.operationId)).to.be.bignumber.equal('0');
          });
        },
      });
    });

    describe('#getNonce', function () {
      describe('when operation is scheduled', function () {
        beforeEach('schedule operation', async function () {
          const method = 'fnRestricted()';
          this.caller = user;
          this.role = { id: web3.utils.toBN(4209043) };
          await this.manager.$_setTargetFunctionRole(this.target.address, selector(method), this.role.id);
          await this.manager.$_grantRole(this.role.id, this.caller, 0, 0);

          this.calldata = await this.target.contract.methods[method]().encodeABI();
          this.delay = time.duration.days(10);

          const { operationId } = await scheduleOperation(this.manager, {
            caller: this.caller,
            target: this.target.address,
            calldata: this.calldata,
            delay: this.delay,
          });
          this.operationId = operationId;
        });

        it('returns nonce', async function () {
          expect(await this.manager.getNonce(this.operationId)).to.be.bignumber.equal('1');
        });
      });

      describe('when is not scheduled', function () {
        it('returns default 0', async function () {
          expect(await this.manager.getNonce(web3.utils.keccak256('operation'))).to.be.bignumber.equal('0');
        });
      });
    });

    describe('#hashOperation', function () {
      it('returns an operationId', async function () {
        const calldata = '0x123543';
        const address = Wallet.generate().getChecksumAddressString();

        const args = [user, address, calldata];

        expect(await this.manager.hashOperation(...args)).to.be.bignumber.eq(
          await web3.utils.keccak256(web3.eth.abi.encodeParameters(['address', 'address', 'bytes'], args)),
        );
      });
    });
  });

  describe('admin operations', function () {
    beforeEach('set required role', function () {
      this.role = this.roles.ADMIN;
    });

    describe('subject to a delay', function () {
      describe('#labelRole', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'labelRole(uint64,string)';
            const args = [123443, 'TEST'];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeDelayedAdminOperation();
        });

        it('emits an event with the label', async function () {
          expectEvent(await this.manager.labelRole(this.roles.SOME.id, 'Some label', { from: admin }), 'RoleLabel', {
            roleId: this.roles.SOME.id,
            label: 'Some label',
          });
        });

        it('updates label on a second call', async function () {
          await this.manager.labelRole(this.roles.SOME.id, 'Some label', { from: admin });

          expectEvent(await this.manager.labelRole(this.roles.SOME.id, 'Updated label', { from: admin }), 'RoleLabel', {
            roleId: this.roles.SOME.id,
            label: 'Updated label',
          });
        });

        it('reverts labeling PUBLIC_ROLE', async function () {
          await expectRevertCustomError(
            this.manager.labelRole(this.roles.PUBLIC.id, 'Some label', { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.PUBLIC.id],
          );
        });

        it('reverts labeling ADMIN_ROLE', async function () {
          await expectRevertCustomError(
            this.manager.labelRole(this.roles.ADMIN.id, 'Some label', { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.ADMIN.id],
          );
        });
      });

      describe('#setRoleAdmin', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setRoleAdmin(uint64,uint64)';
            const args = [93445, 84532];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeDelayedAdminOperation();
        });

        it("sets any role's admin if called by an admin", async function () {
          expect(await this.manager.getRoleAdmin(this.roles.SOME.id)).to.be.bignumber.equal(this.roles.SOME_ADMIN.id);

          const { receipt } = await this.manager.setRoleAdmin(this.roles.SOME.id, this.roles.ADMIN.id, { from: admin });
          expectEvent(receipt, 'RoleAdminChanged', { roleId: this.roles.SOME.id, admin: this.roles.ADMIN.id });

          expect(await this.manager.getRoleAdmin(this.roles.SOME.id)).to.be.bignumber.equal(this.roles.ADMIN.id);
        });

        it('reverts setting PUBLIC_ROLE admin', async function () {
          await expectRevertCustomError(
            this.manager.setRoleAdmin(this.roles.PUBLIC.id, this.roles.ADMIN.id, { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.PUBLIC.id],
          );
        });

        it('reverts setting ADMIN_ROLE admin', async function () {
          await expectRevertCustomError(
            this.manager.setRoleAdmin(this.roles.ADMIN.id, this.roles.ADMIN.id, { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.ADMIN.id],
          );
        });
      });

      describe('#setRoleGuardian', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setRoleGuardian(uint64,uint64)';
            const args = [93445, 84532];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeDelayedAdminOperation();
        });

        it("sets any role's guardian if called by an admin", async function () {
          expect(await this.manager.getRoleGuardian(this.roles.SOME.id)).to.be.bignumber.equal(
            this.roles.SOME_GUARDIAN.id,
          );

          const { receipt } = await this.manager.setRoleGuardian(this.roles.SOME.id, this.roles.ADMIN.id, {
            from: admin,
          });
          expectEvent(receipt, 'RoleGuardianChanged', { roleId: this.roles.SOME.id, guardian: this.roles.ADMIN.id });

          expect(await this.manager.getRoleGuardian(this.roles.SOME.id)).to.be.bignumber.equal(this.roles.ADMIN.id);
        });

        it('reverts setting PUBLIC_ROLE admin', async function () {
          await expectRevertCustomError(
            this.manager.setRoleGuardian(this.roles.PUBLIC.id, this.roles.ADMIN.id, { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.PUBLIC.id],
          );
        });

        it('reverts setting ADMIN_ROLE admin', async function () {
          await expectRevertCustomError(
            this.manager.setRoleGuardian(this.roles.ADMIN.id, this.roles.ADMIN.id, { from: admin }),
            'AccessManagerLockedRole',
            [this.roles.ADMIN.id],
          );
        });
      });

      describe('#setGrantDelay', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setGrantDelay(uint64,uint32)';
            const args = [984910, time.duration.days(2)];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeDelayedAdminOperation();
        });

        describe('when increasing the delay', function () {
          const oldDelay = web3.utils.toBN(10);
          const newDelay = web3.utils.toBN(100);

          beforeEach('sets old delay', async function () {
            this.role = this.roles.SOME;
            await this.manager.$_setGrantDelay(this.role.id, oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(oldDelay);
          });

          it('increases the delay after minsetback', async function () {
            const { receipt } = await this.manager.setGrantDelay(this.role.id, newDelay, { from: admin });
            const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
            expectEvent(receipt, 'RoleGrantDelayChanged', {
              roleId: this.role.id,
              delay: newDelay,
              since: timestamp.add(MINSETBACK),
            });

            expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(newDelay);
          });
        });

        describe('when reducing the delay', function () {
          const oldDelay = time.duration.days(10);

          beforeEach('sets old delay', async function () {
            this.role = this.roles.SOME;
            await this.manager.$_setGrantDelay(this.role.id, oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(oldDelay);
          });

          describe('when the delay difference is shorter than minimum setback', function () {
            const newDelay = oldDelay.subn(1);

            it('increases the delay after minsetback', async function () {
              const { receipt } = await this.manager.setGrantDelay(this.role.id, newDelay, { from: admin });
              const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
              expectEvent(receipt, 'RoleGrantDelayChanged', {
                roleId: this.role.id,
                delay: newDelay,
                since: timestamp.add(MINSETBACK),
              });

              expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(oldDelay);
              await time.increase(MINSETBACK);
              expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(newDelay);
            });
          });

          describe('when the delay difference is longer than minimum setback', function () {
            const newDelay = web3.utils.toBN(1);

            beforeEach('assert delay difference is higher than minsetback', function () {
              expect(oldDelay.sub(newDelay)).to.be.bignumber.gt(MINSETBACK);
            });

            it('increases the delay after delay difference', async function () {
              const setback = oldDelay.sub(newDelay);
              const { receipt } = await this.manager.setGrantDelay(this.role.id, newDelay, { from: admin });
              const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
              expectEvent(receipt, 'RoleGrantDelayChanged', {
                roleId: this.role.id,
                delay: newDelay,
                since: timestamp.add(setback),
              });

              expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(oldDelay);
              await time.increase(setback);
              expect(await this.manager.getRoleGrantDelay(this.role.id)).to.be.bignumber.equal(newDelay);
            });
          });
        });
      });

      describe('#setTargetAdminDelay', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setTargetAdminDelay(address,uint32)';
            const args = [Wallet.generate().getChecksumAddressString(), time.duration.days(3)];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeDelayedAdminOperation();
        });

        describe('when increasing the delay', function () {
          const oldDelay = time.duration.days(10);
          const newDelay = time.duration.days(11);
          const target = Wallet.generate().getChecksumAddressString();

          beforeEach('sets old delay', async function () {
            await this.manager.$_setTargetAdminDelay(target, oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(oldDelay);
          });

          it('increases the delay after minsetback', async function () {
            const { receipt } = await this.manager.setTargetAdminDelay(target, newDelay, { from: admin });
            const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
            expectEvent(receipt, 'TargetAdminDelayUpdated', {
              target,
              delay: newDelay,
              since: timestamp.add(MINSETBACK),
            });

            expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(newDelay);
          });
        });

        describe('when reducing the delay', function () {
          const oldDelay = time.duration.days(10);
          const target = Wallet.generate().getChecksumAddressString();

          beforeEach('sets old delay', async function () {
            await this.manager.$_setTargetAdminDelay(target, oldDelay);
            await time.increase(MINSETBACK);
            expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(oldDelay);
          });

          describe('when the delay difference is shorter than minimum setback', function () {
            const newDelay = oldDelay.subn(1);

            it('increases the delay after minsetback', async function () {
              const { receipt } = await this.manager.setTargetAdminDelay(target, newDelay, { from: admin });
              const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
              expectEvent(receipt, 'TargetAdminDelayUpdated', {
                target,
                delay: newDelay,
                since: timestamp.add(MINSETBACK),
              });

              expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(oldDelay);
              await time.increase(MINSETBACK);
              expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(newDelay);
            });
          });

          describe('when the delay difference is longer than minimum setback', function () {
            const newDelay = web3.utils.toBN(1);

            beforeEach('assert delay difference is higher than minsetback', function () {
              expect(oldDelay.sub(newDelay)).to.be.bignumber.gt(MINSETBACK);
            });

            it('increases the delay after delay difference', async function () {
              const setback = oldDelay.sub(newDelay);
              const { receipt } = await this.manager.setTargetAdminDelay(target, newDelay, { from: admin });
              const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
              expectEvent(receipt, 'TargetAdminDelayUpdated', {
                target,
                delay: newDelay,
                since: timestamp.add(setback),
              });

              expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(oldDelay);
              await time.increase(setback);
              expect(await this.manager.getTargetAdminDelay(target)).to.be.bignumber.equal(newDelay);
            });
          });
        });
      });
    });

    describe('not subject to a delay', function () {
      describe('#updateAuthority', function () {
        beforeEach('create a target and a new authority', async function () {
          this.newAuthority = await AccessManager.new(admin);
          this.newManagedTarget = await AccessManagedTarget.new(this.manager.address);
        });

        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'updateAuthority(address,address)';
            const args = [this.newManagedTarget.address, this.newAuthority.address];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeNotDelayedAdminOperation();
        });

        it('changes the authority', async function () {
          expect(await this.newManagedTarget.authority()).to.be.equal(this.manager.address);

          const { tx } = await this.manager.updateAuthority(this.newManagedTarget.address, this.newAuthority.address, {
            from: admin,
          });

          // Managed contract is responsible of notifying the change through an event
          await expectEvent.inTransaction(tx, this.newManagedTarget, 'AuthorityUpdated', {
            authority: this.newAuthority.address,
          });

          expect(await this.newManagedTarget.authority()).to.be.equal(this.newAuthority.address);
        });
      });

      describe('#setTargetClosed', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setTargetClosed(address,bool)';
            const args = [Wallet.generate().getChecksumAddressString(), true];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeNotDelayedAdminOperation();
        });

        it('closes and opens a target', async function () {
          const close = await this.manager.setTargetClosed(this.target.address, true, { from: admin });
          expectEvent(close.receipt, 'TargetClosed', { target: this.target.address, closed: true });

          expect(await this.manager.isTargetClosed(this.target.address)).to.be.equal(true);

          const open = await this.manager.setTargetClosed(this.target.address, false, { from: admin });
          expectEvent(open.receipt, 'TargetClosed', { target: this.target.address, closed: false });
          expect(await this.manager.isTargetClosed(this.target.address)).to.be.equal(false);
        });

        it('reverts if closing the manager', async function () {
          await expectRevertCustomError(
            this.manager.setTargetClosed(this.manager.address, true, { from: admin }),
            'AccessManagerLockedAccount',
            [this.manager.address],
          );
        });
      });

      describe('#setTargetFunctionRole', function () {
        describe('restrictions', function () {
          beforeEach('set method and args', function () {
            const method = 'setTargetFunctionRole(address,bytes4[],uint64)';
            const args = [Wallet.generate().getChecksumAddressString(), ['0x12345678'], 443342];
            this.calldata = this.manager.contract.methods[method](...args).encodeABI();
          });

          shouldBehaveLikeNotDelayedAdminOperation();
        });

        const sigs = ['someFunction()', 'someOtherFunction(uint256)', 'oneMoreFunction(address,uint8)'].map(selector);

        it('sets function roles', async function () {
          for (const sig of sigs) {
            expect(await this.manager.getTargetFunctionRole(this.target.address, sig)).to.be.bignumber.equal(
              this.roles.ADMIN.id,
            );
          }

          const { receipt: receipt1 } = await this.manager.setTargetFunctionRole(
            this.target.address,
            sigs,
            this.roles.SOME.id,
            {
              from: admin,
            },
          );

          for (const sig of sigs) {
            expectEvent(receipt1, 'TargetFunctionRoleUpdated', {
              target: this.target.address,
              selector: sig,
              roleId: this.roles.SOME.id,
            });
            expect(await this.manager.getTargetFunctionRole(this.target.address, sig)).to.be.bignumber.equal(
              this.roles.SOME.id,
            );
          }

          const { receipt: receipt2 } = await this.manager.setTargetFunctionRole(
            this.target.address,
            [sigs[1]],
            this.roles.SOME_ADMIN.id,
            {
              from: admin,
            },
          );
          expectEvent(receipt2, 'TargetFunctionRoleUpdated', {
            target: this.target.address,
            selector: sigs[1],
            roleId: this.roles.SOME_ADMIN.id,
          });

          for (const sig of sigs) {
            expect(await this.manager.getTargetFunctionRole(this.target.address, sig)).to.be.bignumber.equal(
              sig == sigs[1] ? this.roles.SOME_ADMIN.id : this.roles.SOME.id,
            );
          }
        });
      });

      describe('role admin operations', function () {
        const ANOTHER_ADMIN = web3.utils.toBN(0xdeadc0de1);
        const ANOTHER_ROLE = web3.utils.toBN(0xdeadc0de2);

        beforeEach('set required role', async function () {
          // Make admin a member of ANOTHER_ADMIN
          await this.manager.$_grantRole(ANOTHER_ADMIN, admin, 0, 0);
          await this.manager.$_setRoleAdmin(ANOTHER_ROLE, ANOTHER_ADMIN);

          this.role = { id: ANOTHER_ADMIN };
          this.user = user;
          await this.manager.$_grantRole(this.role.id, this.user, 0, 0);
        });

        describe('#grantRole', function () {
          describe('restrictions', function () {
            beforeEach('set method and args', function () {
              const method = 'grantRole(uint64,address,uint32)';
              const args = [ANOTHER_ROLE, Wallet.generate().getChecksumAddressString(), 0];
              this.calldata = this.manager.contract.methods[method](...args).encodeABI();
            });

            shouldBehaveLikeRoleAdminOperation(ANOTHER_ADMIN);
          });

          describe('when the user is not a role member', function () {
            describe('with grant delay', function () {
              beforeEach('set grant delay and grant role', async function () {
                // Delay granting
                this.grantDelay = time.duration.weeks(2);
                await this.manager.$_setGrantDelay(ANOTHER_ROLE, this.grantDelay);
                await time.increase(MINSETBACK);

                // Grant role
                this.executionDelay = time.duration.days(3);
                expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                  false,
                  '0',
                ]);
                const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.executionDelay, {
                  from: admin,
                });

                this.receipt = receipt;
                this.delay = this.grantDelay; // For shouldBehaveLikeDelay
              });

              shouldBehaveLikeDelay('grant', {
                before: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('does not grant role to the user yet', async function () {
                    const timestamp = await clockFromReceipt.timestamp(this.receipt).then(web3.utils.toBN);
                    expectEvent(this.receipt, 'RoleGranted', {
                      roleId: ANOTHER_ROLE,
                      account: this.user,
                      since: timestamp.add(this.grantDelay),
                      delay: this.executionDelay,
                      newMember: true,
                    });

                    // Access is correctly stored
                    const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                    expect(access[0]).to.be.bignumber.equal(timestamp.add(this.grantDelay)); // inEffectSince
                    expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                    expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                    expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                    // Not in effect yet
                    const currentTimestamp = await time.latest();
                    expect(currentTimestamp).to.be.a.bignumber.lt(access[0]);
                    expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                      false,
                      this.executionDelay.toString(),
                    ]);
                  });
                },
                after: function () {
                  beforeEach('consume previously set grant delay', async function () {
                    // Consume previously set delay
                    await mine();
                  });

                  it('grants role to the user', async function () {
                    const timestamp = await clockFromReceipt.timestamp(this.receipt).then(web3.utils.toBN);
                    expectEvent(this.receipt, 'RoleGranted', {
                      roleId: ANOTHER_ROLE,
                      account: this.user,
                      since: timestamp.add(this.grantDelay),
                      delay: this.executionDelay,
                      newMember: true,
                    });

                    // Access is correctly stored
                    const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                    expect(access[0]).to.be.bignumber.equal(timestamp.add(this.grantDelay)); // inEffectSince
                    expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                    expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                    expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                    // Already in effect
                    const currentTimestamp = await time.latest();
                    expect(currentTimestamp).to.be.a.bignumber.equal(access[0]);
                    expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                      true,
                      this.executionDelay.toString(),
                    ]);
                  });
                },
              });
            });

            describe('without grant delay', function () {
              beforeEach('set granting delay', async function () {
                // Delay granting
                this.grantDelay = 0;
                await this.manager.$_setGrantDelay(ANOTHER_ROLE, this.grantDelay);
                await time.increase(MINSETBACK);
              });

              it('immediately grants the role to the user', async function () {
                this.executionDelay = time.duration.days(6);
                expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                  false,
                  '0',
                ]);
                const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.executionDelay, {
                  from: admin,
                });

                const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);
                expectEvent(receipt, 'RoleGranted', {
                  roleId: ANOTHER_ROLE,
                  account: this.user,
                  since: timestamp,
                  delay: this.executionDelay,
                  newMember: true,
                });

                // Access is correctly stored
                const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                expect(access[0]).to.be.bignumber.equal(timestamp); // inEffectSince
                expect(access[1]).to.be.bignumber.equal(this.executionDelay); // currentDelay
                expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                // Already in effect
                const currentTimestamp = await time.latest();
                expect(currentTimestamp).to.be.a.bignumber.equal(access[0]);
                expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                  true,
                  this.executionDelay.toString(),
                ]);
              });
            });
          });

          describe('when the user is already a role member', function () {
            beforeEach('make user role member', async function () {
              this.previousExecutionDelay = time.duration.days(6);
              await this.manager.$_grantRole(ANOTHER_ROLE, this.user, 0, this.previousExecutionDelay);
              this.oldAccess = await this.manager.getAccess(ANOTHER_ROLE, user);
            });

            describe('with grant delay', function () {
              beforeEach('set granting delay', async function () {
                // Delay granting
                const grantDelay = time.duration.weeks(2);
                await this.manager.$_setGrantDelay(ANOTHER_ROLE, grantDelay);
                await time.increase(MINSETBACK);
              });

              describe('when increasing the execution delay', function () {
                beforeEach('set increased new execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);

                  this.newExecutionDelay = this.previousExecutionDelay.add(time.duration.days(4));
                });

                it('emits event and immediately changes the execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);
                  const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.newExecutionDelay, {
                    from: admin,
                  });
                  const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);

                  expectEvent(receipt, 'RoleGranted', {
                    roleId: ANOTHER_ROLE,
                    account: this.user,
                    since: timestamp,
                    delay: this.newExecutionDelay,
                    newMember: false,
                  });

                  // Access is correctly stored
                  const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                  expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal(this.newExecutionDelay); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Already in effect
                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.newExecutionDelay.toString(),
                  ]);
                });
              });

              describe('when decreasing the execution delay', function () {
                beforeEach('decrease execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);

                  this.newExecutionDelay = this.previousExecutionDelay.sub(time.duration.days(4));
                  const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.newExecutionDelay, {
                    from: admin,
                  });
                  this.grantTimestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);

                  this.receipt = receipt;
                  this.delay = this.previousExecutionDelay.sub(this.newExecutionDelay); // For shouldBehaveLikeDelay
                });

                it('emits event', function () {
                  expectEvent(this.receipt, 'RoleGranted', {
                    roleId: ANOTHER_ROLE,
                    account: this.user,
                    since: this.grantTimestamp.add(this.delay),
                    delay: this.newExecutionDelay,
                    newMember: false,
                  });
                });

                shouldBehaveLikeDelay('execution delay effect', {
                  before: function () {
                    beforeEach('consume effect delay', async function () {
                      // Consume previously set delay
                      await mine();
                    });

                    it('does not change the execution delay yet', async function () {
                      // Access is correctly stored
                      const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                      expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                      expect(access[1]).to.be.bignumber.equal(this.previousExecutionDelay); // currentDelay
                      expect(access[2]).to.be.bignumber.equal(this.newExecutionDelay); // pendingDelay
                      expect(access[3]).to.be.bignumber.equal(this.grantTimestamp.add(this.delay)); // pendingDelayEffect

                      // Not in effect yet
                      expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                        true,
                        this.previousExecutionDelay.toString(),
                      ]);
                    });
                  },
                  after: function () {
                    beforeEach('consume effect delay', async function () {
                      // Consume previously set delay
                      await mine();
                    });

                    it('changes the execution delay', async function () {
                      // Access is correctly stored
                      const access = await this.manager.getAccess(ANOTHER_ROLE, user);

                      expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                      expect(access[1]).to.be.bignumber.equal(this.newExecutionDelay); // currentDelay
                      expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                      expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                      // Already in effect
                      expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                        true,
                        this.newExecutionDelay.toString(),
                      ]);
                    });
                  },
                });
              });
            });

            describe('without grant delay', function () {
              beforeEach('set granting delay', async function () {
                // Delay granting
                const grantDelay = 0;
                await this.manager.$_setGrantDelay(ANOTHER_ROLE, grantDelay);
                await time.increase(MINSETBACK);
              });

              describe('when increasing the execution delay', function () {
                beforeEach('set increased new execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);

                  this.newExecutionDelay = this.previousExecutionDelay.add(time.duration.days(4));
                });

                it('emits event and immediately changes the execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);
                  const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.newExecutionDelay, {
                    from: admin,
                  });
                  const timestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);

                  expectEvent(receipt, 'RoleGranted', {
                    roleId: ANOTHER_ROLE,
                    account: this.user,
                    since: timestamp,
                    delay: this.newExecutionDelay,
                    newMember: false,
                  });

                  // Access is correctly stored
                  const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                  expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                  expect(access[1]).to.be.bignumber.equal(this.newExecutionDelay); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                  // Already in effect
                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.newExecutionDelay.toString(),
                  ]);
                });
              });

              describe('when decreasing the execution delay', function () {
                beforeEach('decrease execution delay', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, this.user).then(formatAccess)).to.be.deep.equal([
                    true,
                    this.previousExecutionDelay.toString(),
                  ]);

                  this.newExecutionDelay = this.previousExecutionDelay.sub(time.duration.days(4));
                  const { receipt } = await this.manager.grantRole(ANOTHER_ROLE, this.user, this.newExecutionDelay, {
                    from: admin,
                  });
                  this.grantTimestamp = await clockFromReceipt.timestamp(receipt).then(web3.utils.toBN);

                  this.receipt = receipt;
                  this.delay = this.previousExecutionDelay.sub(this.newExecutionDelay); // For shouldBehaveLikeDelay
                });

                it('emits event', function () {
                  expectEvent(this.receipt, 'RoleGranted', {
                    roleId: ANOTHER_ROLE,
                    account: this.user,
                    since: this.grantTimestamp.add(this.delay),
                    delay: this.newExecutionDelay,
                    newMember: false,
                  });
                });

                shouldBehaveLikeDelay('execution delay effect', {
                  before: function () {
                    beforeEach('consume effect delay', async function () {
                      // Consume previously set delay
                      await mine();
                    });

                    it('does not change the execution delay yet', async function () {
                      // Access is correctly stored
                      const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                      expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                      expect(access[1]).to.be.bignumber.equal(this.previousExecutionDelay); // currentDelay
                      expect(access[2]).to.be.bignumber.equal(this.newExecutionDelay); // pendingDelay
                      expect(access[3]).to.be.bignumber.equal(this.grantTimestamp.add(this.delay)); // pendingDelayEffect

                      // Not in effect yet
                      expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                        true,
                        this.previousExecutionDelay.toString(),
                      ]);
                    });
                  },
                  after: function () {
                    beforeEach('consume effect delay', async function () {
                      // Consume previously set delay
                      await mine();
                    });

                    it('changes the execution delay', async function () {
                      // Access is correctly stored
                      const access = await this.manager.getAccess(ANOTHER_ROLE, user);

                      expect(access[0]).to.be.bignumber.equal(this.oldAccess[0]); // inEffectSince
                      expect(access[1]).to.be.bignumber.equal(this.newExecutionDelay); // currentDelay
                      expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                      expect(access[3]).to.be.bignumber.equal('0'); // pendingDelayEffect

                      // Already in effect
                      expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                        true,
                        this.newExecutionDelay.toString(),
                      ]);
                    });
                  },
                });
              });
            });
          });
        });

        describe('#revokeRole', function () {
          describe('restrictions', function () {
            beforeEach('set method and args', async function () {
              const method = 'revokeRole(uint64,address)';
              const args = [ANOTHER_ROLE, Wallet.generate().getChecksumAddressString()];
              this.calldata = this.manager.contract.methods[method](...args).encodeABI();

              // Need to be set before revoking
              await this.manager.$_grantRole(...args, 0, 0);
            });

            shouldBehaveLikeRoleAdminOperation(ANOTHER_ADMIN);
          });

          describe('when role has been granted', function () {
            beforeEach('grant role with grant delay', async function () {
              this.grantDelay = time.duration.weeks(1);
              await this.manager.$_grantRole(ANOTHER_ROLE, user, this.grantDelay, 0);

              this.delay = this.grantDelay; // For shouldBehaveLikeDelay
            });

            shouldBehaveLikeDelay('grant', {
              before: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('revokes a granted role that will take effect in the future', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    false,
                    '0',
                  ]);

                  const { receipt } = await this.manager.revokeRole(ANOTHER_ROLE, user, { from: admin });
                  expectEvent(receipt, 'RoleRevoked', { roleId: ANOTHER_ROLE, account: user });

                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    false,
                    '0',
                  ]);

                  const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                  expect(access[0]).to.be.bignumber.equal('0'); // inRoleSince
                  expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // effect
                });
              },
              after: function () {
                beforeEach('consume previously set grant delay', async function () {
                  // Consume previously set delay
                  await mine();
                });

                it('revokes a granted role that already took effect', async function () {
                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    true,
                    '0',
                  ]);

                  const { receipt } = await this.manager.revokeRole(ANOTHER_ROLE, user, { from: admin });
                  expectEvent(receipt, 'RoleRevoked', { roleId: ANOTHER_ROLE, account: user });

                  expect(await this.manager.hasRole(ANOTHER_ROLE, user).then(formatAccess)).to.be.deep.equal([
                    false,
                    '0',
                  ]);

                  const access = await this.manager.getAccess(ANOTHER_ROLE, user);
                  expect(access[0]).to.be.bignumber.equal('0'); // inRoleSince
                  expect(access[1]).to.be.bignumber.equal('0'); // currentDelay
                  expect(access[2]).to.be.bignumber.equal('0'); // pendingDelay
                  expect(access[3]).to.be.bignumber.equal('0'); // effect
                });
              },
            });
          });

          describe('when role has not been granted', function () {
            it('has no effect', async function () {
              expect(await this.manager.hasRole(this.roles.SOME.id, user).then(formatAccess)).to.be.deep.equal([
                false,
                '0',
              ]);
              await this.manager.revokeRole(this.roles.SOME.id, user, { from: manager });
              expect(await this.manager.hasRole(this.roles.SOME.id, user).then(formatAccess)).to.be.deep.equal([
                false,
                '0',
              ]);
            });
          });

          it('reverts revoking PUBLIC_ROLE', async function () {
            await expectRevertCustomError(
              this.manager.revokeRole(this.roles.PUBLIC.id, user, { from: admin }),
              'AccessManagerLockedRole',
              [this.roles.PUBLIC.id],
            );
          });
        });
      });

      describe('self role operations', function () {
        describe('#renounceRole', function () {
          beforeEach('grant role', async function () {
            this.role = { id: web3.utils.toBN(783164) };
            this.caller = user;
            await this.manager.$_grantRole(this.role.id, this.caller, 0, 0);
          });

          it('renounces a role', async function () {
            expect(await this.manager.hasRole(this.role.id, this.caller).then(formatAccess)).to.be.deep.equal([
              true,
              '0',
            ]);
            const { receipt } = await this.manager.renounceRole(this.role.id, this.caller, {
              from: this.caller,
            });
            expectEvent(receipt, 'RoleRevoked', {
              roleId: this.role.id,
              account: this.caller,
            });
            expect(await this.manager.hasRole(this.role.id, this.caller).then(formatAccess)).to.be.deep.equal([
              false,
              '0',
            ]);
          });

          it('reverts if renouncing the PUBLIC_ROLE', async function () {
            await expectRevertCustomError(
              this.manager.renounceRole(this.roles.PUBLIC.id, this.caller, {
                from: this.caller,
              }),
              'AccessManagerLockedRole',
              [this.roles.PUBLIC.id],
            );
          });

          it('reverts if renouncing with bad caller confirmation', async function () {
            await expectRevertCustomError(
              this.manager.renounceRole(this.role.id, Wallet.generate().getChecksumAddressString(), {
                from: this.caller,
              }),
              'AccessManagerBadConfirmation',
              [],
            );
          });
        });
      });
    });
  });

  describe('access managed target', function () {
    describe('when calling a restricted target function', function () {
      const method = 'fnRestricted()';

      beforeEach('set required role', function () {
        this.role = { id: web3.utils.toBN(3597243) };
        this.manager.$_setTargetFunctionRole(this.target.address, selector(method), this.role.id);
      });

      describe('restrictions', function () {
        beforeEach('set method and args', function () {
          this.calldata = this.target.contract.methods[method]().encodeABI();
          this.caller = user;
        });

        shouldBehaveLikeAManagedRestrictedOperation();
      });

      it('succeeds called by a role member', async function () {
        await this.manager.$_grantRole(this.role.id, user, 0, 0);

        const { receipt } = await this.target.methods[method]({
          data: this.calldata,
          from: user,
        });
        expectEvent(receipt, 'CalledRestricted', {
          caller: user,
        });
      });
    });

    describe('when calling a non-restricted target function', function () {
      const method = 'fnUnrestricted()';

      beforeEach('set required role', function () {
        this.role = { id: web3.utils.toBN(879435) };
        this.manager.$_setTargetFunctionRole(this.target.address, selector(method), this.role.id);
      });

      it('succeeds called by anyone', async function () {
        const { receipt } = await this.target.methods[method]({
          data: this.calldata,
          from: user,
        });
        expectEvent(receipt, 'CalledUnrestricted', {
          caller: user,
        });
      });
    });
  });

  describe('with Ownable target contract', function () {
    const roleId = web3.utils.toBN(1);

    beforeEach(async function () {
      this.ownable = await Ownable.new(this.manager.address);

      // add user to role
      await this.manager.$_grantRole(roleId, user, 0, 0);
    });

    it('initial state', async function () {
      expect(await this.ownable.owner()).to.be.equal(this.manager.address);
    });

    describe('Contract is closed', function () {
      beforeEach(async function () {
        await this.manager.$_setTargetClosed(this.ownable.address, true);
      });

      it('directly call: reverts', async function () {
        await expectRevertCustomError(this.ownable.$_checkOwner({ from: user }), 'OwnableUnauthorizedAccount', [user]);
      });

      it('relayed call (with role): reverts', async function () {
        await expectRevertCustomError(
          this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: user }),
          'AccessManagerUnauthorizedCall',
          [user, this.ownable.address, selector('$_checkOwner()')],
        );
      });

      it('relayed call (without role): reverts', async function () {
        await expectRevertCustomError(
          this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: other }),
          'AccessManagerUnauthorizedCall',
          [other, this.ownable.address, selector('$_checkOwner()')],
        );
      });
    });

    describe('Contract is managed', function () {
      describe('function is open to specific role', function () {
        beforeEach(async function () {
          await this.manager.$_setTargetFunctionRole(this.ownable.address, selector('$_checkOwner()'), roleId);
        });

        it('directly call: reverts', async function () {
          await expectRevertCustomError(this.ownable.$_checkOwner({ from: user }), 'OwnableUnauthorizedAccount', [
            user,
          ]);
        });

        it('relayed call (with role): success', async function () {
          await this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: user });
        });

        it('relayed call (without role): reverts', async function () {
          await expectRevertCustomError(
            this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: other }),
            'AccessManagerUnauthorizedCall',
            [other, this.ownable.address, selector('$_checkOwner()')],
          );
        });
      });

      describe('function is open to public role', function () {
        beforeEach(async function () {
          await this.manager.$_setTargetFunctionRole(
            this.ownable.address,
            selector('$_checkOwner()'),
            this.roles.PUBLIC.id,
          );
        });

        it('directly call: reverts', async function () {
          await expectRevertCustomError(this.ownable.$_checkOwner({ from: user }), 'OwnableUnauthorizedAccount', [
            user,
          ]);
        });

        it('relayed call (with role): success', async function () {
          await this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: user });
        });

        it('relayed call (without role): success', async function () {
          await this.manager.execute(this.ownable.address, selector('$_checkOwner()'), { from: other });
        });
      });
    });
  });
});
