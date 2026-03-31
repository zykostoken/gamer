# ZykosToken (ZKS) — Smart Contracts

## Current: ZykosTokenV4.sol
Definitive contract ready for BSC mainnet deploy.

### Deployed (paused):
- BSC Mainnet: `0xB4D46f6C550AA855307085b8970D971Cdeafb030`
- Status: PAUSED (decimal bug in V1)

### V4 Fixes over V1:
1. ALL amounts in 18 decimals (V1 mixed 6 and 18 → supply value destroyed)
2. 20% of total supply (20M tokens) reserved at deploy for airdrops + bounties
3. `batchAirdrop()` — send to up to 200 addresses in one tx
4. `batchBounty()` — pay bounties to up to 200 addresses in one tx
5. USDC normalization: 6→18 decimals handled in buyWithUSDC()
6. Treasury split: 50/25/12.5/12.5 (same as V1, but in basis points)
7. Toast states: Virgin → Bronze → Charcoal (circular economy)

### To deploy:
1. Compile in Remix (Solidity 0.8.20, EVM Paris)
2. Constructor args: USDC address, USDT address, 4 treasury addresses, airdrop vault
3. Deploy with ~0.5 BNB gas
4. Approve airdropBountyVault to spend ZKS on this contract
5. Verify on BscScan

### Legacy:
- `legacy/ZykosTokenV1_despliegator.sol` — original with 6/18 bug
- `legacy/ZykosTokenV2_consolidacion.sol` — consolidated with author-centered model

### BSC Addresses (mainnet):
- USDC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
- USDT: `0x55d398326f99059fF775485246999027B3197955`
