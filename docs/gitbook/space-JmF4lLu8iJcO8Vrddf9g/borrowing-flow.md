---
title: "Borrowing Flow"
---

Borrowing Flow
==============

1.  **Deposit Collateral:** Choose a supported asset and deposit it into your Paydax vault (an interaction with the LendingPool smart contract). You retain ownership, and all transactions are transparent on the blockchain.
    
2.  **Borrow Assets:** Based on the collateral deposited and the fixed LTV for that pair, borrow the desired blue-chip cryptocurrency (e.g., borrow USDC using ETH, or borrow ETH using PDP). The system handles all token transfers through secure smart contracts.
    
3.  **Maintain Health Factor:** Continuously monitor your Health Factor (calculated by the CollateralManager). If it drops below 1.0, your position is eligible for liquidation. A 5% penalty applies, and up to 50% of your position can be liquidated to bring the HF back to a safe level.
    
4.  **Repay and Unlock Collateral:** Repay the borrowed asset plus accrued simple interest (compounded at repayment). Once the debt is cleared, your collateral is fully unlocked from the LendingPool contract.
