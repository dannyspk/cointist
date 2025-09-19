---
title: "Smart Contract Architecture "
---

Smart Contract Architecture
===========================

The Paydax protocol is built on a modular smart contract system to ensure security, transparency, and efficiency. The core contracts include:
```
contract PDProtocolToken {
function stake(uint256 amount) external; 
function unstake(uint256 amount) external; 
function claimRewards() external;
}

contract LendingPool {
mapping(address => mapping(address => uint256)) deposits; // user => token => amount 
mapping(address => mapping(address => uint256)) borrows; // user => token => amount

function deposit(address token, uint256 amount) external; 
function withdraw(address token, uint256 amount) external;
function borrow(address collateralToken, address borrowToken, uint256 amount) 
external; function repay(address token, uint256 amount) external;
}

contract CollateralManager {
function getHealthFactor(address user) external view returns (uint256); 
function liquidate(address user, address collateralToken) external; 
function isLiquidatable(address user) external view returns (bool);
}
```

These contracts handle token staking, lending/borrowing operations, and collateral management, ensuring seamless user interactions and robust risk controls.

![](https://paydax.gitbook.io/paydax-docs/~gitbook/image?url=https%3A%2F%2F3818830755-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FJmF4lLu8iJcO8Vrddf9g%252Fuploads%252Fc8YlcCdIdn1EKMYCIvTb%252FWhitepaper%2520%288%29.png%3Falt%3Dmedia%26token%3D2aab4ec5-072e-4f09-b913-5304da738389&width=768&dpr=4&quality=100&sign=38868c69&sv=2)
