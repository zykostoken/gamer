// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ZykosToken (ZKS) V4 — THE BLACKBOOK
 * @author Dr. Gonzalo Pérez Cortizo / Clínica José Ingenieros SRL
 * @notice Meme token with organic economic design + clinical utility backing
 * @dev V4 fixes: ALL 18 decimals, 20% airdrop/bounty reserve at deploy,
 *      batch airdrop + bounty functions, modular for future expansion
 *
 * DISCLAIMER: This is a meme token. No promises. No roadmap. No guaranteed utility.
 * 100 pools. Prices increase irregularly. By design. DYOR. NFA.
 *
 * THE BLACKBOOK: 100M tokens | 100 pools | 10 batches
 * 20% reserved for airdrops + bounties at deploy
 * Max: $50k per day | 8400s cooldown
 * Toast economy: Virgin → Bronze → Charcoal (circular, not burn)
 */
contract ZykosToken is ERC20, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // CONSTANTS — ALL IN 18 DECIMALS
    // ============================================

    uint256 public constant TOTAL_SUPPLY           = 100_000_000 * 1e18;  // 100M tokens
    uint256 public constant TOKENS_PER_POOL        = 1_000_000 * 1e18;    // 1M per pool
    uint256 public constant POOL_COUNT             = 100;

    // 20% of total supply reserved for airdrops + bounties at deploy
    uint256 public constant AIRDROP_BOUNTY_RESERVE = 20_000_000 * 1e18;   // 20M tokens
    uint256 public constant SALE_SUPPLY            = 80_000_000 * 1e18;   // 80M for pools

    // Purchase limits — USD in 18 decimals (matches USDC/USDT after normalization)
    uint256 public constant MAX_DAILY_USD          = 50_000 * 1e18;       // $50k daily
    uint256 public constant COOLDOWN_PERIOD        = 8400;                // seconds

    // Pool activation thresholds
    uint256 public constant ACTIVATION_THRESHOLD   = 91;  // % sold to activate next
    uint256 public constant RELEASE_THRESHOLD      = 97;  // % sold to release

    // Treasury split (basis points: 10000 = 100%)
    uint256 public constant TREASURY_MAIN_BPS      = 5000;  // 50%
    uint256 public constant TREASURY_DEV_BPS       = 2500;  // 25%
    uint256 public constant TREASURY_NODE_BPS      = 1250;  // 12.5%
    uint256 public constant TREASURY_RESERVE_BPS   = 1250;  // 12.5%

    // ============================================
    // STATE
    // ============================================

    IERC20 public immutable USDC;
    IERC20 public immutable USDT;

    address public treasuryMain;
    address public treasuryDev;
    address public treasuryNode;
    address public treasuryReserve;
    address public airdropBountyVault;

    // Toast states: Virgin (untouched) → Bronze (traded) → Charcoal (heavy use)
    enum ToastState { Virgin, Bronze, Charcoal }

    struct Pool {
        uint256 pricePerToken;      // in 18 decimals (wei of USD)
        uint256 tokensRemaining;
        uint256 totalSold;
        bool    active;
    }

    struct BuyerInfo {
        uint256 totalPurchased;
        uint256 dailyPurchased;
        uint256 lastPurchaseDay;
        uint256 lastPurchaseTime;
        ToastState toastState;
    }

    Pool[100] public pools;
    mapping(address => BuyerInfo) public buyers;

    uint256 public currentPool;
    uint256 public currentBatch;       // 0-9, each batch = 10 pools
    uint256 public totalUsdReceived;

    // Airdrop/Bounty tracking
    uint256 public airdropDistributed;
    uint256 public bountyDistributed;

    // ServiceBatch for institutional payments (future)
    struct ServiceBatch {
        uint256 amount;
        uint256 timestamp;
        address node;
        bytes32 serviceType;
    }
    mapping(address => ServiceBatch[]) public serviceBatches;

    // ============================================
    // EVENTS
    // ============================================

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 usdPaid, uint256 poolId);
    event PoolActivated(uint256 indexed poolId, uint256 pricePerToken);
    event BatchCompleted(uint256 indexed batchId);
    event AirdropSent(address indexed to, uint256 amount, string reason);
    event BountyPaid(address indexed to, uint256 amount, string task);
    event BatchAirdropExecuted(uint256 recipients, uint256 totalAmount);
    event BatchBountyExecuted(uint256 recipients, uint256 totalAmount);
    event ToastStateChanged(address indexed holder, ToastState newState);
    event TreasurySplit(uint256 main, uint256 dev, uint256 node, uint256 reserve);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _usdc,
        address _usdt,
        address _treasuryMain,
        address _treasuryDev,
        address _treasuryNode,
        address _treasuryReserve,
        address _airdropBountyVault
    ) ERC20("ZykosToken", "ZKS") Ownable(msg.sender) {
        require(_usdc != address(0) && _usdt != address(0), "Invalid stablecoin");
        require(_treasuryMain != address(0), "Invalid treasury");
        require(_airdropBountyVault != address(0), "Invalid airdrop vault");

        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);
        treasuryMain    = _treasuryMain;
        treasuryDev     = _treasuryDev;
        treasuryNode    = _treasuryNode;
        treasuryReserve = _treasuryReserve;
        airdropBountyVault = _airdropBountyVault;

        // Mint total supply to contract
        _mint(address(this), TOTAL_SUPPLY);

        // Transfer 20% to airdrop/bounty vault immediately
        _transfer(address(this), _airdropBountyVault, AIRDROP_BOUNTY_RESERVE);

        // Initialize 100 pools with irregular pricing
        _initializePools();
    }

    // ============================================
    // POOL INITIALIZATION
    // ============================================

    function _initializePools() internal {
        // 100 pools, prices $0.05 to $0.12 (in 18 decimals)
        // Irregular increase — not linear, by design
        uint256[10] memory batchBasePrices = [
            50_000_000_000_000_000,    // $0.050
            55_000_000_000_000_000,    // $0.055
            60_000_000_000_000_000,    // $0.060
            65_000_000_000_000_000,    // $0.065
            70_000_000_000_000_000,    // $0.070
            78_000_000_000_000_000,    // $0.078
            85_000_000_000_000_000,    // $0.085
            92_000_000_000_000_000,    // $0.092
            100_000_000_000_000_000,   // $0.100
            120_000_000_000_000_000    // $0.120
        ];

        // Each pool gets 800k tokens (80M / 100 pools from sale supply)
        uint256 tokensPerSalePool = SALE_SUPPLY / POOL_COUNT;

        for (uint256 i = 0; i < POOL_COUNT; i++) {
            uint256 batchIdx = i / 10;
            // Add small irregular variation within each batch
            uint256 variation = (i % 10) * 500_000_000_000_000; // +$0.0005 per pool in batch
            pools[i] = Pool({
                pricePerToken: batchBasePrices[batchIdx] + variation,
                tokensRemaining: tokensPerSalePool,
                totalSold: 0,
                active: i == 0  // Only first pool active at start
            });
        }
    }

    // ============================================
    // BUY FUNCTIONS
    // ============================================

    function buyWithUSDC(uint256 tokenAmount) external nonReentrant whenNotPaused {
        uint256 usdAmount = _calculateCost(tokenAmount);
        // USDC has 6 decimals on BSC — normalize to 18
        uint256 usdcAmount = usdAmount / 1e12;
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);
        _processPurchase(msg.sender, tokenAmount, usdAmount);
    }

    function buyWithUSDT(uint256 tokenAmount) external nonReentrant whenNotPaused {
        uint256 usdAmount = _calculateCost(tokenAmount);
        // USDT has 18 decimals on BSC
        USDT.safeTransferFrom(msg.sender, address(this), usdAmount);
        _processPurchase(msg.sender, tokenAmount, usdAmount);
    }

    function _calculateCost(uint256 tokenAmount) internal view returns (uint256) {
        Pool storage pool = pools[currentPool];
        require(pool.active, "Pool not active");
        require(tokenAmount > 0 && tokenAmount <= pool.tokensRemaining, "Invalid amount");
        // Both tokenAmount and pricePerToken are in 18 decimals
        // Result is in 18 decimals (USD)
        return (tokenAmount * pool.pricePerToken) / 1e18;
    }

    function _processPurchase(address buyer, uint256 tokenAmount, uint256 usdAmount) internal {
        BuyerInfo storage info = buyers[buyer];

        // Daily limit check
        uint256 today = block.timestamp / 1 days;
        if (info.lastPurchaseDay != today) {
            info.dailyPurchased = 0;
            info.lastPurchaseDay = today;
        }
        require(info.dailyPurchased + usdAmount <= MAX_DAILY_USD, "Daily limit exceeded");

        // Cooldown check
        require(block.timestamp >= info.lastPurchaseTime + COOLDOWN_PERIOD, "Cooldown active");

        // Update buyer
        info.totalPurchased += tokenAmount;
        info.dailyPurchased += usdAmount;
        info.lastPurchaseTime = block.timestamp;

        // Update toast state
        if (info.toastState == ToastState.Virgin) {
            info.toastState = ToastState.Bronze;
            emit ToastStateChanged(buyer, ToastState.Bronze);
        }

        // Update pool
        Pool storage pool = pools[currentPool];
        pool.tokensRemaining -= tokenAmount;
        pool.totalSold += tokenAmount;

        // Transfer tokens to buyer
        _transfer(address(this), buyer, tokenAmount);

        // Split USD to treasuries
        _splitTreasury(usdAmount);

        totalUsdReceived += usdAmount;
        emit TokensPurchased(buyer, tokenAmount, usdAmount, currentPool);

        // Check pool progression
        uint256 soldPct = (pool.totalSold * 100) / (SALE_SUPPLY / POOL_COUNT);
        if (soldPct >= ACTIVATION_THRESHOLD && currentPool + 1 < POOL_COUNT) {
            if (!pools[currentPool + 1].active) {
                pools[currentPool + 1].active = true;
                emit PoolActivated(currentPool + 1, pools[currentPool + 1].pricePerToken);
            }
        }
        if (soldPct >= RELEASE_THRESHOLD && currentPool + 1 < POOL_COUNT) {
            currentPool++;
            if (currentPool % 10 == 0) {
                currentBatch++;
                emit BatchCompleted(currentBatch - 1);
            }
        }
    }

    function _splitTreasury(uint256 usdAmount) internal {
        // For USDC (6 decimals), amounts need normalization
        // This function works with the raw stablecoin amounts
        uint256 toMain    = (usdAmount * TREASURY_MAIN_BPS) / 10000;
        uint256 toDev     = (usdAmount * TREASURY_DEV_BPS) / 10000;
        uint256 toNode    = (usdAmount * TREASURY_NODE_BPS) / 10000;
        uint256 toReserve = usdAmount - toMain - toDev - toNode;

        // Transfer USDC (normalize back to 6 decimals for USDC)
        // For simplicity, transfer from contract balance
        // The stablecoins are already in the contract from safeTransferFrom
        if (USDC.balanceOf(address(this)) >= usdAmount / 1e12) {
            USDC.safeTransfer(treasuryMain,    toMain / 1e12);
            USDC.safeTransfer(treasuryDev,     toDev / 1e12);
            USDC.safeTransfer(treasuryNode,    toNode / 1e12);
            USDC.safeTransfer(treasuryReserve, toReserve / 1e12);
        }

        emit TreasurySplit(toMain, toDev, toNode, toReserve);
    }

    // ============================================
    // AIRDROP + BOUNTY FUNCTIONS
    // ============================================

    /**
     * @notice Send airdrop to a single address from the vault
     * @dev Only owner can call. Tokens come from airdropBountyVault.
     */
    function airdrop(address to, uint256 amount, string calldata reason) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        // Transfer from vault (vault must have approved this contract)
        IERC20(address(this)).safeTransferFrom(airdropBountyVault, to, amount);
        airdropDistributed += amount;
        emit AirdropSent(to, amount, reason);
    }

    /**
     * @notice Batch airdrop to multiple addresses
     * @dev Arrays must be same length. Max 200 per tx to avoid gas limit.
     */
    function batchAirdrop(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length <= 200, "Max 200 per batch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid address");
            totalAmount += amounts[i];
        }

        // Transfer all from vault to this contract first
        IERC20(address(this)).safeTransferFrom(airdropBountyVault, address(this), totalAmount);

        // Distribute
        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(address(this), recipients[i], amounts[i]);
            emit AirdropSent(recipients[i], amounts[i], reason);
        }

        airdropDistributed += totalAmount;
        emit BatchAirdropExecuted(recipients.length, totalAmount);
    }

    /**
     * @notice Pay bounty to a single address
     */
    function bounty(address to, uint256 amount, string calldata task) external onlyOwner {
        require(to != address(0), "Invalid address");
        IERC20(address(this)).safeTransferFrom(airdropBountyVault, to, amount);
        bountyDistributed += amount;
        emit BountyPaid(to, amount, task);
    }

    /**
     * @notice Batch bounty payment
     */
    function batchBounty(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string[] calldata tasks
    ) external onlyOwner {
        require(recipients.length == amounts.length && amounts.length == tasks.length, "Length mismatch");
        require(recipients.length <= 200, "Max 200 per batch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            totalAmount += amounts[i];
        }

        IERC20(address(this)).safeTransferFrom(airdropBountyVault, address(this), totalAmount);

        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(address(this), recipients[i], amounts[i]);
            emit BountyPaid(recipients[i], amounts[i], tasks[i]);
        }

        bountyDistributed += totalAmount;
        emit BatchBountyExecuted(recipients.length, totalAmount);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setTreasuryMain(address _t) external onlyOwner {
        require(_t != address(0), "Invalid");
        treasuryMain = _t;
    }

    function setTreasuryDev(address _t) external onlyOwner {
        require(_t != address(0), "Invalid");
        treasuryDev = _t;
    }

    function setTreasuryNode(address _t) external onlyOwner {
        require(_t != address(0), "Invalid");
        treasuryNode = _t;
    }

    function setTreasuryReserve(address _t) external onlyOwner {
        require(_t != address(0), "Invalid");
        treasuryReserve = _t;
    }

    function setAirdropBountyVault(address _v) external onlyOwner {
        require(_v != address(0), "Invalid");
        airdropBountyVault = _v;
    }

    /**
     * @notice Rescue accidentally sent tokens (not ZKS or stablecoins)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot rescue ZKS");
        require(token != address(USDC) && token != address(USDT), "Cannot rescue stablecoins");
        IERC20(token).safeTransfer(to, amount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getPoolInfo(uint256 poolId) external view returns (
        uint256 price, uint256 remaining, uint256 sold, bool active
    ) {
        Pool storage p = pools[poolId];
        return (p.pricePerToken, p.tokensRemaining, p.totalSold, p.active);
    }

    function getBuyerInfo(address buyer) external view returns (
        uint256 totalPurchased, uint256 dailyPurchased,
        uint256 lastPurchaseTime, ToastState toastState
    ) {
        BuyerInfo storage b = buyers[buyer];
        return (b.totalPurchased, b.dailyPurchased, b.lastPurchaseTime, b.toastState);
    }

    function airdropBountyRemaining() external view returns (uint256) {
        return balanceOf(airdropBountyVault);
    }

    function currentPoolPrice() external view returns (uint256) {
        return pools[currentPool].pricePerToken;
    }

    function currentPoolRemaining() external view returns (uint256) {
        return pools[currentPool].tokensRemaining;
    }
}
