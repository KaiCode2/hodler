# HODLER
A custodial smart contract for the solo crypto user.

**Use Cases:**
1. Protection against compromised keys
2. Account recover from lost key

### Account Recovery
When the smart contract is initially created, the creator provides a *recoveryCommitment*. In the event the *owner* address is lost or compromised, the user may submit a *recoveryNullifier* to the contract to recover the account. A user may appoint a social recovery address of someone they trust; if there is a social recovery address, this hard recovery will be time-delayed 5 days and may only be cancelled by the social recovery address. Otherwise, the hard recovery is immediately executed.

### Compromised Keys
Should a user's primary key become compromised, an attacker will be unable to steal the user's assets (held by the smart contract) without knowing their unlock password. In this event, a user should invoke the hard recovery mechanism to remove the compromised wallet from being the owner.


## User Stories

#### UniSwap LP
I, a UniSwap liquidity provider, hold tens of thousands of dollars worth of crypto in my positions. While they're yielding returns, I want to transfer custody over to the *Custodian* smart contract to protect me against a lost or compromised key. Should I want to rebalance my positions, I can unlock the smart contract by creating a proof using my password. From there, the contract will be unlocked for my wallet for the next 12 hours - or until I deliberately lock the contract. 

When unlocked, I can either proxy calls through the contract or instruct the contract to transfer custody of certain assets back to me.
