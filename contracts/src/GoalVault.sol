// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Minimal Circle CCTP v2 TokenMessenger surface used to burn USDC on
 * Arbitrum Sepolia and have it minted back to a backer on their origin domain
 * during an all-or-nothing refund. Only the pieces GoalVault calls are declared.
 * Full spec: https://developers.circle.com/stablecoins/evm-smart-contracts
 */
interface ITokenMessengerV2 {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;
}

/**
 * @title GoalVault
 * @notice All-or-nothing crowdfunding escrow for the Rally cross-chain
 *         fundraising thermometer. Deployed on Arbitrum Sepolia.
 *
 *         USDC arrives at this vault two ways:
 *           1. Same-chain (Arbitrum Sepolia): a backer calls {contribute}
 *              directly. Fully trustless — the vault pulls their USDC and
 *              credits msg.sender with sourceDomain == LOCAL_DOMAIN.
 *           2. Cross-chain: Circle CCTP v2 mints USDC straight to this vault's
 *              address on Arbitrum Sepolia (mintRecipient = vault). The vault
 *              cannot see *who* on the source chain sent it, so the app relayer
 *              calls {recordContribution} to attribute the mint to
 *              (campaign, backer, sourceDomain).
 *
 *         On the deadline:
 *           - raised >= goal  => the beneficiary withdraws the consolidated USDC.
 *           - raised <  goal  => every backer can {refund} (locally on Arbitrum
 *             Sepolia) or a relayer can trigger {refundCrossChain} which burns
 *             the USDC via CCTP v2 back to the backer on their origin domain.
 *
 * @dev CCTP ATTRIBUTION TRUST MODEL (documented honestly for the hackathon):
 *      The vault does not (and cannot cheaply) verify the source-chain sender of
 *      a CCTP mint on-chain, so a permissioned `relayer` attributes mints via
 *      {recordContribution}. That trust is deliberately BOUNDED by an accounting
 *      invariant enforced in the contract:
 *
 *          token.balanceOf(address(this)) >= totalEscrowed   (always)
 *
 *      {recordContribution} requires the USDC to have *physically arrived* before
 *      it may be credited (balance must already cover totalEscrowed + amount).
 *      Therefore a malicious/buggy relayer can misattribute *real* deposits
 *      (wrong backer or wrong sourceDomain) but can NEVER (a) conjure funds that
 *      do not exist, (b) inflate a campaign's raised total beyond deposited USDC,
 *      or (c) drain the contract — withdrawals only ever pay a campaign's own
 *      raised amount and refunds only ever pay a backer their own credited amount.
 *      Upgrading to trustless attribution means routing mints through a CCTP v2
 *      hook that carries (campaignId, backer) in hookData; the relayer is the
 *      hackathon-grade stand-in for that hook.
 */
contract GoalVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        Active, // now < deadline and goal not yet reached
        Succeeded, // goal reached (funds may be withdrawable or already withdrawn)
        Failed // deadline passed without reaching goal (refundable)
    }

    struct Campaign {
        address creator; // who opened the campaign
        address beneficiary; // who receives funds on success
        uint256 goal; // target USDC (6 decimals) — success when raised >= goal
        uint64 deadline; // unix seconds; contributions accepted while now < deadline
        uint256 raised; // cumulative USDC credited to this campaign
        bool withdrawn; // beneficiary has swept the funds
        uint32 contributionCount; // number of contribution records logged
    }

    struct Contribution {
        address backer; // credited contributor
        uint256 amount; // USDC amount
        uint32 sourceDomain; // CCTP domain the funds originated from
        uint64 timestamp; // when it was recorded
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice The escrowed token (USDC on Arbitrum Sepolia). Immutable.
    IERC20 public immutable token;

    /// @notice CCTP domain of the chain this vault lives on (Arbitrum Sepolia = 3).
    uint32 public immutable LOCAL_DOMAIN;

    /// @notice Permissioned address allowed to attribute CCTP mints. See trust model.
    address public relayer;

    /// @notice Circle CCTP v2 TokenMessenger, used for cross-chain refunds. Optional.
    ITokenMessengerV2 public tokenMessenger;

    /// @notice CCTP v2 burn params for cross-chain refunds (standard transfer defaults).
    uint256 public cctpMaxFee; // 0 = standard (slow, free) transfer
    uint32 public cctpMinFinalityThreshold = 2000; // 2000 = standard finality

    /// @notice Settlement grace window: a relayer may still attribute a CCTP mint
    ///         that was in-flight across the deadline for this long afterwards, so
    ///         a legitimately-burned-but-late contribution is never stranded.
    ///         Standard L2 transfers attest in ~15-19 min; 1h covers them with room.
    uint64 public constant SETTLEMENT_GRACE = 1 hours;

    /// @notice Earliest time {rescueExcess} may run: the latest
    ///         (campaign deadline + SETTLEMENT_GRACE) across all campaigns. Until
    ///         then a stray-looking balance could still be a legitimately-arrived
    ///         CCTP mint awaiting attribution, so it must not be sweepable.
    uint256 public rescueUnlockTime;

    /// @notice Total USDC currently held on behalf of all campaigns (not yet paid out).
    uint256 public totalEscrowed;

    uint256 public nextCampaignId = 1; // 0 is reserved as "does not exist"

    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => Contribution[]) private _contributions;

    // campaignId => backer => total credited
    mapping(uint256 => mapping(address => uint256)) private _contributedTotal;
    // campaignId => backer => sourceDomain => credited amount (for cross-chain refund routing)
    mapping(uint256 => mapping(address => mapping(uint32 => uint256))) private _contributedByDomain;
    // campaignId => backer => list of source domains they used (deduplicated)
    mapping(uint256 => mapping(address => uint32[])) private _backerDomains;
    // campaignId => backer => domain => seen (dedup helper for _backerDomains)
    mapping(uint256 => mapping(address => mapping(uint32 => bool))) private _domainSeen;

    // ---------------------------------------------------------------------
    // Events (the Rally thermometer subscribes to these)
    // ---------------------------------------------------------------------

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address indexed beneficiary,
        uint256 goal,
        uint64 deadline
    );

    event ContributionRecorded(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 amount,
        uint32 indexed sourceDomain,
        uint256 newRaised,
        uint256 contributionIndex
    );

    event GoalReached(uint256 indexed campaignId, uint256 raised, uint256 goal);

    event Withdrawn(uint256 indexed campaignId, address indexed beneficiary, uint256 amount);

    event Refunded(uint256 indexed campaignId, address indexed backer, uint256 amount);

    event CrossChainRefundInitiated(
        uint256 indexed campaignId, address indexed backer, uint32 indexed destinationDomain, uint256 amount
    );

    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event TokenMessengerUpdated(address indexed oldMessenger, address indexed newMessenger);
    event CctpRefundParamsUpdated(uint256 maxFee, uint32 minFinalityThreshold);
    event ExcessRescued(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error InvalidGoal();
    error DeadlineInPast();
    error DeadlineTooFar();
    error CampaignNotFound();
    error CampaignClosed(); // deadline passed or already withdrawn
    error NotRelayer();
    error NotBeneficiary();
    error UnattributedFunds(); // relayer tried to credit more than physically arrived
    error GoalNotReached();
    error AlreadyWithdrawn();
    error NotFailed(); // refund attempted while campaign is not in Failed state
    error NothingToRefund();
    error CrossChainRefundDisabled();
    error LocalDomainNotCrossChain();
    error NotBackerOrRelayer(); // cross-chain refund may only be triggered by the backer or relayer
    error RescueLocked(); // rescueExcess called before all campaigns have settled

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        if (_campaigns[campaignId].creator == address(0)) revert CampaignNotFound();
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @param _token       USDC on Arbitrum Sepolia.
     * @param _localDomain CCTP domain of this chain (Arbitrum Sepolia = 3).
     * @param _relayer     Initial trusted attributor (may be updated by owner).
     * @param _owner       Contract admin.
     */
    constructor(IERC20 _token, uint32 _localDomain, address _relayer, address _owner) Ownable(_owner) {
        if (address(_token) == address(0)) revert ZeroAddress();
        if (_relayer == address(0)) revert ZeroAddress();
        token = _token;
        LOCAL_DOMAIN = _localDomain;
        relayer = _relayer;
        emit RelayerUpdated(address(0), _relayer);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(relayer, _relayer);
        relayer = _relayer;
    }

    function setTokenMessenger(ITokenMessengerV2 _messenger) external onlyOwner {
        emit TokenMessengerUpdated(address(tokenMessenger), address(_messenger));
        tokenMessenger = _messenger;
    }

    function setCctpRefundParams(uint256 _maxFee, uint32 _minFinalityThreshold) external onlyOwner {
        cctpMaxFee = _maxFee;
        cctpMinFinalityThreshold = _minFinalityThreshold;
        emit CctpRefundParamsUpdated(_maxFee, _minFinalityThreshold);
    }

    /**
     * @notice Recover USDC that landed in the vault but was never attributed to a
     *         campaign (e.g. a stray transfer). Can never touch escrowed funds:
     *         only the slack `balance - totalEscrowed` is movable.
     * @dev    Gated by {rescueUnlockTime}: it may only run once every campaign's
     *         settlement grace window has elapsed. Before that, an unattributed
     *         balance could still be a legitimate CCTP mint awaiting
     *         {recordContribution}, so sweeping it would strand a backer's funds.
     */
    function rescueExcess(address to) external onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        if (block.timestamp < rescueUnlockTime) revert RescueLocked();
        uint256 bal = token.balanceOf(address(this));
        amount = bal - totalEscrowed; // reverts on underflow if invariant ever broke
        if (amount == 0) revert ZeroAmount();
        token.safeTransfer(to, amount);
        emit ExcessRescued(to, amount);
    }

    // ---------------------------------------------------------------------
    // Campaign lifecycle
    // ---------------------------------------------------------------------

    /**
     * @notice Open a new all-or-nothing campaign. Permissionless.
     * @param goal        Target USDC (must be > 0). Success when raised >= goal.
     * @param deadline    Unix seconds in the future; contributions close at deadline.
     * @param beneficiary Address paid on success.
     * @return campaignId The new campaign id (starts at 1).
     */
    function createCampaign(uint256 goal, uint64 deadline, address beneficiary)
        external
        returns (uint256 campaignId)
    {
        if (goal == 0) revert InvalidGoal();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        campaignId = nextCampaignId++;
        _campaigns[campaignId] = Campaign({
            creator: msg.sender,
            beneficiary: beneficiary,
            goal: goal,
            deadline: deadline,
            raised: 0,
            withdrawn: false,
            contributionCount: 0
        });

        // Push out the rescue lock so a stray-looking balance can never be swept
        // while this campaign could still receive an in-flight CCTP mint.
        uint256 unlock = uint256(deadline) + SETTLEMENT_GRACE;
        if (unlock > rescueUnlockTime) rescueUnlockTime = unlock;

        emit CampaignCreated(campaignId, msg.sender, beneficiary, goal, deadline);
    }

    /**
     * @notice Same-chain (Arbitrum Sepolia) contribution. Fully trustless: pulls
     *         `amount` USDC from msg.sender and credits them with LOCAL_DOMAIN.
     *         The backer must have approved this vault for `amount` first.
     */
    function contribute(uint256 campaignId, uint256 amount)
        external
        nonReentrant
        campaignExists(campaignId)
    {
        if (amount == 0) revert ZeroAmount();
        _requireOpen(campaignId);

        // Measure actual received to be robust against non-standard tokens.
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        _credit(campaignId, msg.sender, received, LOCAL_DOMAIN);
    }

    /**
     * @notice Attribute a CCTP v2 mint that has already landed in this vault to a
     *         (campaign, backer, sourceDomain). Only callable by the relayer.
     * @dev    Bounded-trust: reverts unless the vault's USDC balance already covers
     *         totalEscrowed + amount, so the relayer can only ever attribute funds
     *         that physically arrived. See the CCTP ATTRIBUTION TRUST MODEL above.
     */
    function recordContribution(uint256 campaignId, address backer, uint256 amount, uint32 sourceDomain)
        external
        nonReentrant
        onlyRelayer
        campaignExists(campaignId)
    {
        if (backer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        // A CCTP mint may have been burned before the deadline but only landed
        // (and been attested) shortly after it. Allow the relayer to attribute it
        // within the settlement grace window so those funds are never stranded.
        _requireCreditable(campaignId);

        // The mint must have physically arrived and not already be spoken for.
        if (token.balanceOf(address(this)) < totalEscrowed + amount) revert UnattributedFunds();

        _credit(campaignId, backer, amount, sourceDomain);
    }

    /**
     * @notice Beneficiary (or creator) sweeps the consolidated USDC once the goal
     *         is reached. Callable as soon as raised >= goal — no need to wait for
     *         the deadline — which also closes the campaign to further contributions.
     */
    function withdraw(uint256 campaignId) external nonReentrant campaignExists(campaignId) {
        Campaign storage c = _campaigns[campaignId];
        if (msg.sender != c.beneficiary && msg.sender != c.creator) revert NotBeneficiary();
        if (c.withdrawn) revert AlreadyWithdrawn();
        if (c.raised < c.goal) revert GoalNotReached();

        uint256 amount = c.raised;

        // Effects before interaction (CEI) + nonReentrant guard.
        c.withdrawn = true;
        totalEscrowed -= amount;

        token.safeTransfer(c.beneficiary, amount);
        emit Withdrawn(campaignId, c.beneficiary, amount);
    }

    /**
     * @notice Refund a backer's full contribution *on Arbitrum Sepolia* after a
     *         missed campaign. This is the always-available trustless degrade path
     *         (the "claim refund on Arbitrum Sepolia" page).
     */
    function refund(uint256 campaignId) external nonReentrant campaignExists(campaignId) {
        _refund(campaignId, msg.sender, msg.sender);
    }

    /**
     * @notice Refund an arbitrary backer (relayer convenience for a UX where the
     *         app triggers refunds on behalf of email-login users). Funds still go
     *         only to the backer; the relayer cannot redirect them.
     */
    function refundFor(uint256 campaignId, address backer)
        external
        nonReentrant
        onlyRelayer
        campaignExists(campaignId)
    {
        _refund(campaignId, backer, backer);
    }

    /**
     * @notice All-or-nothing CHERRY: on a miss, burn a backer's USDC via CCTP v2
     *         back to *their own address* on each origin domain they contributed
     *         from. Local-domain funds are transferred directly. mintRecipient is
     *         hard-coded to the backer, so this cannot redirect funds.
     * @dev    Requires a configured tokenMessenger for any non-local domain.
     */
    function refundCrossChain(uint256 campaignId, address backer)
        external
        nonReentrant
        campaignExists(campaignId)
    {
        // Access control: only the backer themselves or the trusted relayer may
        // trigger a cross-chain refund. mintRecipient is hard-coded to `backer`,
        // but a backer may not control that address on the origin chain, so a
        // stranger must not be able to force the irreversible cross-chain burn.
        if (msg.sender != backer && msg.sender != relayer) revert NotBackerOrRelayer();
        _requireFailed(campaignId);
        uint256 total = _contributedTotal[campaignId][backer];
        if (total == 0) revert NothingToRefund();

        // Zero all bookkeeping up-front (CEI) before any external calls.
        _contributedTotal[campaignId][backer] = 0;
        totalEscrowed -= total;
        uint32[] storage domains = _backerDomains[campaignId][backer];

        uint256 len = domains.length;
        for (uint256 i = 0; i < len; i++) {
            uint32 domain = domains[i];
            uint256 amount = _contributedByDomain[campaignId][backer][domain];
            if (amount == 0) continue;
            _contributedByDomain[campaignId][backer][domain] = 0;

            if (domain == LOCAL_DOMAIN) {
                token.safeTransfer(backer, amount);
                emit Refunded(campaignId, backer, amount);
            } else {
                if (address(tokenMessenger) == address(0)) revert CrossChainRefundDisabled();
                token.forceApprove(address(tokenMessenger), amount);
                tokenMessenger.depositForBurn(
                    amount,
                    domain,
                    _toBytes32(backer),
                    address(token),
                    bytes32(0), // any destinationCaller may finalize
                    cctpMaxFee,
                    cctpMinFinalityThreshold
                );
                emit CrossChainRefundInitiated(campaignId, backer, domain, amount);
            }
        }
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _credit(uint256 campaignId, address backer, uint256 amount, uint32 sourceDomain) private {
        Campaign storage c = _campaigns[campaignId];

        bool crossedGoal = c.raised < c.goal && c.raised + amount >= c.goal;

        c.raised += amount;
        totalEscrowed += amount;

        _contributedTotal[campaignId][backer] += amount;
        _contributedByDomain[campaignId][backer][sourceDomain] += amount;
        if (!_domainSeen[campaignId][backer][sourceDomain]) {
            _domainSeen[campaignId][backer][sourceDomain] = true;
            _backerDomains[campaignId][backer].push(sourceDomain);
        }

        uint256 index = _contributions[campaignId].length;
        _contributions[campaignId].push(
            Contribution({backer: backer, amount: amount, sourceDomain: sourceDomain, timestamp: uint64(block.timestamp)})
        );
        c.contributionCount = uint32(index + 1);

        emit ContributionRecorded(campaignId, backer, amount, sourceDomain, c.raised, index);
        if (crossedGoal) emit GoalReached(campaignId, c.raised, c.goal);
    }

    function _refund(uint256 campaignId, address backer, address to) private {
        _requireFailed(campaignId);
        uint256 total = _contributedTotal[campaignId][backer];
        if (total == 0) revert NothingToRefund();

        // Effects before interaction.
        _contributedTotal[campaignId][backer] = 0;
        totalEscrowed -= total;

        uint32[] storage domains = _backerDomains[campaignId][backer];
        uint256 len = domains.length;
        for (uint256 i = 0; i < len; i++) {
            _contributedByDomain[campaignId][backer][domains[i]] = 0;
        }

        token.safeTransfer(to, total);
        emit Refunded(campaignId, backer, total);
    }

    /// @dev Reverts unless the campaign is still accepting contributions.
    function _requireOpen(uint256 campaignId) private view {
        Campaign storage c = _campaigns[campaignId];
        if (c.withdrawn || block.timestamp >= c.deadline) revert CampaignClosed();
    }

    /// @dev Reverts unless the relayer may still attribute an arriving CCTP mint:
    ///      not yet withdrawn, and within `deadline + SETTLEMENT_GRACE`. This is
    ///      strictly looser than {_requireOpen} and is ONLY used by the
    ///      relayer-gated {recordContribution} path — same-chain {contribute}
    ///      keeps the strict pre-deadline check.
    function _requireCreditable(uint256 campaignId) private view {
        Campaign storage c = _campaigns[campaignId];
        if (c.withdrawn) revert CampaignClosed();
        if (block.timestamp >= uint256(c.deadline) + SETTLEMENT_GRACE) revert CampaignClosed();
    }

    /// @dev Reverts unless the campaign has failed (deadline passed, goal missed, not withdrawn).
    function _requireFailed(uint256 campaignId) private view {
        Campaign storage c = _campaigns[campaignId];
        if (c.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < c.deadline || c.raised >= c.goal) revert NotFailed();
    }

    function _toBytes32(address a) private pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    // ---------------------------------------------------------------------
    // Views (frontend + relayer)
    // ---------------------------------------------------------------------

    function getCampaign(uint256 campaignId)
        external
        view
        returns (
            address creator,
            address beneficiary,
            uint256 goal,
            uint64 deadline,
            uint256 raised,
            bool withdrawn,
            uint32 contributionCount
        )
    {
        Campaign storage c = _campaigns[campaignId];
        return (c.creator, c.beneficiary, c.goal, c.deadline, c.raised, c.withdrawn, c.contributionCount);
    }

    function status(uint256 campaignId) public view returns (Status) {
        Campaign storage c = _campaigns[campaignId];
        if (c.raised >= c.goal && c.goal > 0) return Status.Succeeded;
        if (block.timestamp >= c.deadline) return Status.Failed;
        return Status.Active;
    }

    /// @notice True once raised >= goal (money can be withdrawn by the beneficiary).
    function isSuccessful(uint256 campaignId) external view returns (bool) {
        Campaign storage c = _campaigns[campaignId];
        return c.goal > 0 && c.raised >= c.goal;
    }

    /// @notice True while backers can claim refunds (deadline passed, goal missed, not withdrawn).
    function isRefundable(uint256 campaignId) external view returns (bool) {
        Campaign storage c = _campaigns[campaignId];
        return c.creator != address(0) && !c.withdrawn && block.timestamp >= c.deadline && c.raised < c.goal;
    }

    /// @notice Total USDC a backer has credited to a campaign (0 after refund).
    function contributionOf(uint256 campaignId, address backer) external view returns (uint256) {
        return _contributedTotal[campaignId][backer];
    }

    /// @notice USDC a backer credited from a specific CCTP source domain.
    function contributionOfByDomain(uint256 campaignId, address backer, uint32 sourceDomain)
        external
        view
        returns (uint256)
    {
        return _contributedByDomain[campaignId][backer][sourceDomain];
    }

    /// @notice The distinct source domains a backer contributed from — the data a
    ///         relayer needs to route a cross-chain CCTP refund back per domain.
    function backerDomains(uint256 campaignId, address backer) external view returns (uint32[] memory) {
        return _backerDomains[campaignId][backer];
    }

    /// @notice How much a backer could refund right now (0 unless the campaign failed).
    function refundableAmount(uint256 campaignId, address backer) external view returns (uint256) {
        Campaign storage c = _campaigns[campaignId];
        if (c.withdrawn || block.timestamp < c.deadline || c.raised >= c.goal) return 0;
        return _contributedTotal[campaignId][backer];
    }

    function contributionsCount(uint256 campaignId) external view returns (uint256) {
        return _contributions[campaignId].length;
    }

    function getContribution(uint256 campaignId, uint256 index) external view returns (Contribution memory) {
        return _contributions[campaignId][index];
    }

    /// @notice Full contribution log for a campaign (view-only; for off-chain feeds).
    function getContributions(uint256 campaignId) external view returns (Contribution[] memory) {
        return _contributions[campaignId];
    }
}
