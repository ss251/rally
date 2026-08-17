#!/usr/bin/env python3
"""Generate docs/hackathon/rally-project-map.excalidraw — a study board for Sailesh."""

from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path(__file__).with_name("rally-project-map.excalidraw")

# Rally palette
INK = "#191122"
PAPER = "#f6f1f9"
MUTED = "#6f6579"
CORAL = "#ff6b4a"
AMBER = "#ffb020"
BASE = "#3b82f6"
ARB = "#12b8d4"
OP = "#fb7185"
SOL = "#a855f7"
CARD = "#fff8f1"
GOALS_BG = "#fff0e8"
CIRCLES_BG = "#e8f7ff"
SPINE_BG = "#f3e8ff"
OK_BG = "#e6f8ee"
WARN_BG = "#fff3d6"
DANGER_BG = "#ffe8e4"
NOTE_BG = "#f4f0ea"

FONT_HAND = 5  # Excalifont
FONT_SANS = 2  # Helvetica


class Gen:
    def __init__(self) -> None:
        self.elements: list[dict] = []
        self.n = 0
        self.rng = random.Random(21)

    def uid(self, prefix: str = "e") -> str:
        self.n += 1
        return f"{prefix}{self.n:04d}"

    def seed(self) -> int:
        return self.rng.randint(1, 2_000_000_000)

    def base(
        self,
        typ: str,
        x: float,
        y: float,
        w: float,
        h: float,
        *,
        frame_id: str | None,
        extra: dict | None = None,
    ) -> dict:
        el = {
            "id": self.uid(typ[:2]),
            "type": typ,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "angle": 0,
            "strokeColor": INK,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "groupIds": [],
            "frameId": frame_id,
            "index": f"a{self.n:05d}",
            "roundness": {"type": 3} if typ in {"rectangle", "ellipse"} else None,
            "seed": self.seed(),
            "version": 1,
            "versionNonce": self.seed(),
            "isDeleted": False,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
        }
        if extra:
            el.update(extra)
        self.elements.append(el)
        return el

    def frame(self, x: float, y: float, w: float, h: float, name: str) -> dict:
        return self.base(
            "frame",
            x,
            y,
            w,
            h,
            frame_id=None,
            extra={
                "name": name,
                "strokeColor": "#bbb",
                "backgroundColor": "transparent",
                "roundness": None,
            },
        )

    def text(
        self,
        x: float,
        y: float,
        text: str,
        *,
        size: int = 18,
        color: str = INK,
        align: str = "left",
        font: int = FONT_SANS,
        frame_id: str | None = None,
        w: float | None = None,
        h: float | None = None,
        container_id: str | None = None,
        valign: str = "top",
    ) -> dict:
        lines = text.split("\n")
        width = w if w is not None else max(8, max(len(line) for line in lines) * size * 0.55)
        height = h if h is not None else size * 1.25 * len(lines) + 4
        el = self.base(
            "text",
            x,
            y,
            width,
            height,
            frame_id=frame_id,
            extra={
                "text": text,
                "originalText": text,
                "fontSize": size,
                "fontFamily": font,
                "textAlign": align,
                "verticalAlign": valign,
                "containerId": container_id,
                "autoResize": container_id is None,
                "lineHeight": 1.25,
                "strokeColor": color,
                "backgroundColor": "transparent",
                "roundness": None,
                "baseline": int(size),
            },
        )
        return el

    def box(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        text: str,
        *,
        bg: str = CARD,
        stroke: str = INK,
        size: int = 16,
        font: int = FONT_SANS,
        frame_id: str | None = None,
        sw: int = 2,
    ) -> dict:
        rect = self.base(
            "rectangle",
            x,
            y,
            w,
            h,
            frame_id=frame_id,
            extra={"backgroundColor": bg, "strokeColor": stroke, "strokeWidth": sw},
        )
        t = self.text(
            x,
            y,
            text,
            size=size,
            font=font,
            align="center",
            frame_id=frame_id,
            w=w,
            h=h,
            container_id=rect["id"],
            valign="middle",
            color=INK,
        )
        rect["boundElements"].append({"id": t["id"], "type": "text"})
        return rect

    def diamond(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        text: str,
        *,
        bg: str = WARN_BG,
        frame_id: str | None = None,
    ) -> dict:
        d = self.base(
            "diamond",
            x,
            y,
            w,
            h,
            frame_id=frame_id,
            extra={"backgroundColor": bg, "roundness": {"type": 2}},
        )
        t = self.text(
            x,
            y,
            text,
            size=15,
            align="center",
            frame_id=frame_id,
            w=w,
            h=h,
            container_id=d["id"],
            valign="middle",
        )
        d["boundElements"].append({"id": t["id"], "type": "text"})
        return d

    def arrow(
        self,
        a: dict,
        b: dict,
        *,
        frame_id: str | None,
        label: str | None = None,
        color: str = INK,
        dashed: bool = False,
    ) -> dict:
        ax = a["x"] + a["width"] / 2
        ay = a["y"] + a["height"] / 2
        bx = b["x"] + b["width"] / 2
        by = b["y"] + b["height"] / 2
        # leave the boxes via the nearest edges
        dx, dy = bx - ax, by - ay
        if abs(dx) >= abs(dy):
            x1 = a["x"] + a["width"] if dx > 0 else a["x"]
            y1 = ay
            x2 = b["x"] if dx > 0 else b["x"] + b["width"]
            y2 = by
        else:
            x1 = ax
            y1 = a["y"] + a["height"] if dy > 0 else a["y"]
            x2 = bx
            y2 = b["y"] if dy > 0 else b["y"] + b["height"]
        el = self.base(
            "arrow",
            x1,
            y1,
            0,
            0,
            frame_id=frame_id,
            extra={
                "width": abs(x2 - x1) or 1,
                "height": abs(y2 - y1) or 1,
                "points": [[0, 0], [x2 - x1, y2 - y1]],
                "strokeColor": color,
                "strokeStyle": "dashed" if dashed else "solid",
                "roundness": {"type": 2},
                "startBinding": {"elementId": a["id"], "focus": 0, "gap": 6},
                "endBinding": {"elementId": b["id"], "focus": 0, "gap": 6},
                "startArrowhead": None,
                "endArrowhead": "arrow",
                "elbowed": False,
            },
        )
        a["boundElements"].append({"id": el["id"], "type": "arrow"})
        b["boundElements"].append({"id": el["id"], "type": "arrow"})
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            self.text(mx - 40, my - 14, label, size=13, color=MUTED, frame_id=frame_id)
        return el

    def note(self, x: float, y: float, w: float, h: float, text: str, frame_id: str, bg: str = NOTE_BG) -> dict:
        return self.box(x, y, w, h, text, bg=bg, size=14, frame_id=frame_id, sw=1)

    def dump(self) -> dict:
        return {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": self.elements,
            "appState": {
                "gridSize": 20,
                "gridStep": 5,
                "gridModeEnabled": False,
                "viewBackgroundColor": PAPER,
            },
            "files": {},
        }


def build() -> dict:
    g = Gen()
    FW, FH = 1560, 980
    GAP = 120

    def fx(i: int) -> float:
        return i * (FW + GAP)

    # ── 0 Index ──────────────────────────────────────────────────────────
    f0 = g.frame(fx(0), 0, FW, FH, "0 · How to read this")
    i0 = f0["id"]
    g.text(40, 30, "Rally — understand-your-own-project map", size=36, font=FONT_HAND, frame_id=i0)
    g.text(
        40,
        80,
        "One primitive. Two shapes. The chain never introduces itself.\nOpen in excalidraw.com → Menu → Open → this file. Drag boards around; nothing is locked.",
        size=18,
        color=MUTED,
        frame_id=i0,
    )
    boards = [
        (40, 200, "1  The primitive", "What Rally is, in one sentence.\nWhy group money died.\nThe promise."),
        (400, 200, "2  Two shapes", "Goals = hit it or refund.\nCircles = rotate the pot or refund.\nSame contract-held pot."),
        (760, 200, "3  What the user sees", "Email → amount → done.\nNo wallet, gas, bridge, or network picker."),
        (1120, 200, "4  Invisible spine", "Magic 7702 · ZeroDev · CCTP · vaults.\nWho does what under the button."),
        (40, 480, "5  Money rail", "Burn on any testnet → Iris ~10s\n→ mint into the Arbitrum vault."),
        (400, 480, "6  Goals machine", "create → chip in → succeed/withdraw\nor fail/refund. Relayer bounds."),
        (760, 480, "7  Circles machine", "invites → start → deposit → claim.\nMiss a round → Broken → refund."),
        (1120, 480, "8  Trust & keys", "Who can steal (nobody).\nWho can mis-label (relayer).\nDemo vs self-custody."),
        (40, 760, "9  Proof + 3-min pitch", "Live URLs, explorer receipts,\nbeat sheet for Friday."),
    ]
    for x, y, title, body in boards:
        g.box(x, y, 320, 200, f"{title}\n\n{body}", bg=CARD, size=15, frame_id=i0)
    g.note(
        400,
        760,
        720,
        160,
        "How to use this before Tuesday practice\n\nWalk boards 1→3 out loud (that's the pitch). Boards 4→8 are so you can answer\njudges without flipping to code. Board 9 is the demo run-of-show.",
        i0,
        WARN_BG,
    )

    # ── 1 Primitive ──────────────────────────────────────────────────────
    f1 = g.frame(fx(1), 0, FW, FH, "1 · The primitive")
    i1 = f1["id"]
    g.text(40, 24, "The primitive", size=34, font=FONT_HAND, frame_id=i1)
    g.box(
        40,
        90,
        1480,
        110,
        "Rally is conditional group money.\nOne link lets people who already know each other move money together under a condition a contract enforces.\nIt pays out together — or it refunds everyone. Automatically. Nobody holds the pot. Including us.",
        bg=GOALS_BG,
        size=20,
        font=FONT_HAND,
        frame_id=i1,
        sw=3,
    )
    thesis = g.box(40, 240, 460, 200, "The thesis\n\nCrowdfunding strangers is a graveyard.\nThe money that actually pools is money\nbetween people who know each other.\nNobody owns that primitive.", bg=CARD, frame_id=i1)
    paypal = g.box(540, 240, 460, 200, "What died\n\nPayPal Money Pools — shut 2021,\nnever replaced.\nEvery group-money product died\nthe same way: somebody had to\nhold the money.", bg=DANGER_BG, frame_id=i1)
    informal = g.box(1040, 240, 480, 200, "What still runs on a person\n\nChit funds · tandas · susus.\nLargest informal instrument on earth.\nA trusted foreman can walk off\nwith the pot.", bg=WARN_BG, frame_id=i1)
    promise = g.box(
        40,
        480,
        720,
        220,
        "The promise (say this once, then show it)\n\n• One shareable link\n• Email in — no seed, no extension, no gas\n• Chip in from whatever chain they already hold USDC on\n• A contract holds the pot\n• Hit the condition → payout. Miss it → everyone is refunded.",
        bg=OK_BG,
        frame_id=i1,
    )
    notthis = g.box(
        800,
        480,
        720,
        220,
        "What Rally is not\n\n• Not Kickstarter for strangers\n• Not a bridge UI\n• Not a wallet you install\n• Not a DAO\n• Not mainnet / not real money (testnet by design)",
        bg=NOTE_BG,
        frame_id=i1,
    )
    g.box(
        40,
        740,
        1480,
        180,
        "Guiding test for every feature: does it make the chain more invisible, and does it make the promise easier to trust?\nRally wins by being the group-money app that happens to be onchain — never the onchain app that happens to do group money.",
        bg=SPINE_BG,
        size=18,
        font=FONT_HAND,
        frame_id=i1,
    )
    g.arrow(thesis, paypal, frame_id=i1)
    g.arrow(paypal, informal, frame_id=i1)

    # ── 2 Two shapes ─────────────────────────────────────────────────────
    f2 = g.frame(fx(2), 0, FW, FH, "2 · Two shapes")
    i2 = f2["id"]
    g.text(40, 24, "One primitive, two shapes", size=34, font=FONT_HAND, frame_id=i2)
    g.box(40, 90, 1480, 70, "Same link mechanics · same email login · same refund guarantee · pot held by a contract", bg=SPINE_BG, size=18, frame_id=i2)

    goals = g.box(
        40,
        190,
        720,
        520,
        "GOALS  ·  GoalVault\n0x914e…0AB4   Arbitrum Sepolia   Ownable (relayer + owner = deployer)\n\nOne-shot, all-or-nothing.\n“Send the crew to Tokyo — $2,000 by Friday.”\n\n1. Organizer sets goal + deadline → one link\n    createCampaign is permissionless\n2. Friends open the link, email-login, chip in USDC\n    from whatever chain they hold it on\n3. Goal hit before deadline → organizer withdraws\n    one consolidated pot\n   Missed → every backer reclaims. Escrow tracks\n    {sourceDomain, amount} so refunds can rail home.\n\nStatus: Active → Succeeded | Failed\nLive: /c/1 (hero) · /c/2 (created in-product)",
        bg=GOALS_BG,
        size=16,
        frame_id=i2,
        sw=3,
    )
    circ = g.box(
        800,
        190,
        720,
        520,
        "CIRCLES  ·  RotatingVault\n0xdd9b…7838   Arbitrum Sepolia   OWNERLESS\n\nThe chit fund / tanda / susu, minus the foreman.\n\n1. Organizer starts a circle: N seats, fixed amount,\n    round length. Each seat gets a signed invite.\n2. Every round, everyone chips in the same amount.\n    When the round fills, ONE member takes the pot.\n    Turn rotates until everyone has had theirs.\n3. Anyone misses? Circle stops. Everyone still\n    holding a deposit is refunded. Automatically.\n\nNo admin key can touch the money.\nLive: /circle/1 (rotating) · /circle/2 (broke + refunded)",
        bg=CIRCLES_BG,
        size=16,
        frame_id=i2,
        sw=3,
    )
    g.box(
        40,
        740,
        1480,
        180,
        "The switch on the landing (Goals · Circles) is the product, not a nav item.\nYou are showing judges that the same promise has two faces — a trip pot and a savings committee — and that the refund rail is real in both.",
        bg=CARD,
        size=18,
        font=FONT_HAND,
        frame_id=i2,
    )

    # ── 3 User journey ───────────────────────────────────────────────────
    f3 = g.frame(fx(3), 0, FW, FH, "3 · What the user sees")
    i3 = f3["id"]
    g.text(40, 24, "The entire product interaction", size=34, font=FONT_HAND, frame_id=i3)
    g.text(40, 80, "If you remember one row, remember this one. Everything else is underneath.", size=18, color=MUTED, frame_id=i3)

    steps = [
        (40, "Open the link", "Landing /c/$id\nor /circle/$id\nBar is live RPC."),
        (340, "Email", "Magic OTP.\nNo seed phrase.\nNo extension."),
        (640, "Embedded wallet", "EIP-7702 minted\nbehind the code.\nType-4 tx."),
        (940, "Pick an amount", "USDC they already\nhold, any supported\ntestnet."),
        (1240, "Done", "You're in ✦\nBar rises.\nName in the feed."),
    ]
    prev = None
    for x, title, body in steps:
        box = g.box(x, 160, 260, 220, f"{title}\n\n{body}", bg=CARD, size=16, frame_id=i3, sw=2)
        if prev:
            g.arrow(prev, box, frame_id=i3, color=CORAL)
        prev = box

    g.box(
        40,
        430,
        720,
        240,
        "What they never see\n\n• A seed phrase or recovery kit\n• A browser extension or “connect wallet”\n• A gas prompt or ETH faucet lecture\n• A network switcher\n• A bridge UI or “wrapped USDC”\n• The words CCTP, 7702, paymaster, relayer",
        bg=DANGER_BG,
        frame_id=i3,
    )
    g.box(
        800,
        430,
        720,
        240,
        "Celebration copy (the product’s voice)\n\n• You're in ✦\n• You got the pot ✦\n• Money's back ✦\n\nThe bar is the light source. Chain colors live\nin the mercury (Base blue · Arb cyan · OP coral).\nCanvas is warm plum, not crypto-black.",
        bg=GOALS_BG,
        frame_id=i3,
    )
    g.box(
        40,
        700,
        1480,
        220,
        "Two create lanes you must be able to explain in one breath\n\nGOALS create  —  permissionless createCampaign. Relayer pays gas to open; beneficiary = creator’s email wallet.\nCIRCLES create  —  REAL path is self-custodied: creator’s 7702 wallet is the on-chain organizer, signs every EIP-712 invite in the browser, alone can start.\n                  DEMO path (“demo friends” toggle) — Rally relayer organizes so a solo walkthrough works. The UI says so. Do not hide this.",
        bg=WARN_BG,
        size=16,
        frame_id=i3,
    )

    # ── 4 Spine ──────────────────────────────────────────────────────────
    f4 = g.frame(fx(4), 0, FW, FH, "4 · Invisible spine")
    i4 = f4["id"]
    g.text(40, 24, "What happens under “Chip in”", size=34, font=FONT_HAND, frame_id=i4)

    layers = [
        (40, "UI", "TanStack Start  ·  React 19  ·  Vite  ·  Nitro SSR\nRailway  ·  localhost:3000 = bun run dev\nReads vaults live over public RPC (works without Alchemy)."),
        (40, "Identity", "Magic email OTP  →  embedded EOA\nEIP-7702 delegation (real Type-4, authorizationList)\nZeroDev kernel + paymaster  →  gasless writes"),
        (40, "Money in", "Circle CCTP v2  ·  testnet USDC\nSource: Base / OP / Arb Sepolia\nIris attestation ~10s  ·  mintRecipient = vault"),
        (40, "Custody", "GoalVault 0x914e…0AB4  (goals, ownable)\nRotatingVault 0xdd9b…7838  (circles, ownerless)\nHome chain: Arbitrum Sepolia"),
        (40, "Server", "Same process as the web app (no separate API).\nRelayer key + dispenser key never ship to the client.\nCampaign titles live in RALLY_META_FILE, not on-chain."),
    ]
    # draw as a vertical stack of full-width layers
    y = 100
    colors = [CARD, SPINE_BG, CIRCLES_BG, GOALS_BG, NOTE_BG]
    prev = None
    for (idx, ((_, title, body), bg)) in enumerate(zip(layers, colors)):
        box = g.box(40, y, 1480, 130, f"{title}     {body}", bg=bg, size=16, frame_id=i4)
        if prev:
            g.arrow(prev, box, frame_id=i4, color=MUTED)
        prev = box
        y += 155

    # ── 5 Money rail ─────────────────────────────────────────────────────
    f5 = g.frame(fx(5), 0, FW, FH, "5 · Money rail (CCTP v2)")
    i5 = f5["id"]
    g.text(40, 24, "The bar fills because USDC actually moved", size=32, font=FONT_HAND, frame_id=i5)

    src = g.box(40, 160, 420, 280, "SOURCE CHAIN\nBase / OP / Arb Sepolia\n\n1. approve USDC → TokenMessengerV2\n2. depositForBurn(...)\n   dest domain = 3 (Arb)\n   mintRecipient = vault\n\nUSDC is burned. Gone here.", bg="#dbeafe", stroke=BASE, frame_id=i5, sw=3)
    iris = g.box(560, 160, 420, 280, "CIRCLE IRIS  (off-chain)\n\nWaits for finality.\nSigns the message.\n\nGET /v2/messages/{domain}\n    ?transactionHash=0x…\n\nMeasured live: ~9.8 s fast.", bg=WARN_BG, stroke=AMBER, frame_id=i5, sw=3)
    dst = g.box(1080, 160, 440, 280, "DEST  ·  Arbitrum Sepolia\n\n3. receiveMessage(msg, att)\n   Anyone can submit.\n   Rally’s relayer does.\n\nUSDC mints into GoalVault.\nThen recordContribution\nattributes (campaign, backer,\nsourceDomain).", bg="#cffafe", stroke=ARB, frame_id=i5, sw=3)
    g.arrow(src, iris, frame_id=i5, color=BASE)
    g.arrow(iris, dst, frame_id=i5, color=ARB)

    g.box(
        40,
        500,
        720,
        400,
        "Why the bar is multi-colored\n\nEach contribution stores sourceDomain on-chain.\nThe UI paints a band per chain:\n\n  Base        #3b82f6\n  Arbitrum    #22d3ee\n  Optimism    #fb7185\n  Solana      #a855f7   (docs only, not live yet)\n\n“Half of this came from Base” is readable\nin the mercury. That is the pitch, made visual.",
        bg=CARD,
        frame_id=i5,
    )
    g.box(
        800,
        500,
        720,
        400,
        "Two chip-in paths (Goals)\n\nA. Backer-funded (honest / preferred)\n   Their 7702 wallet holds USDC → they burn.\n   Relayer only relays mint + record.\n\nB. Empty fresh email wallet\n   Dispenser: GitHub-gated faucet → Base USDC\n   into THEIR wallet, then path A.\n   Kill switch: DISPENSER_FALLBACK=relayer\n   restores the old “relayer fronts the burn.”\n\nRelayer USDC is finite. Cap $10 / chip-in.\nNever pretend B is the user paying.",
        bg=WARN_BG,
        frame_id=i5,
    )

    # ── 6 Goals machine ──────────────────────────────────────────────────
    f6 = g.frame(fx(6), 0, FW, FH, "6 · Goals state machine")
    i6 = f6["id"]
    g.text(40, 24, "GoalVault — all or nothing", size=34, font=FONT_HAND, frame_id=i6)

    c = g.box(40, 140, 280, 120, "createCampaign\ngoal · deadline\nbeneficiary", bg=CARD, frame_id=i6)
    a = g.box(400, 140, 280, 120, "Active\nnow < deadline\nraised < goal", bg=CIRCLES_BG, frame_id=i6)
    s = g.box(860, 80, 280, 120, "Succeeded\nraised ≥ goal", bg=OK_BG, frame_id=i6)
    fail = g.box(860, 260, 280, 120, "Failed\ndeadline hit\nraised < goal", bg=DANGER_BG, frame_id=i6)
    w = g.box(1240, 80, 260, 120, "withdraw\nbeneficiary\ngets the pot", bg=OK_BG, frame_id=i6)
    r = g.box(1240, 260, 260, 120, "refund /\nrefundCrossChain\nbacker gets theirs", bg=DANGER_BG, frame_id=i6)
    chip = g.box(400, 360, 280, 120, "chip in\ncontribute  or\nCCTP + recordContribution", bg=GOALS_BG, frame_id=i6)
    g.arrow(c, a, frame_id=i6)
    g.arrow(a, s, frame_id=i6, label="goal hit")
    g.arrow(a, fail, frame_id=i6, label="time up")
    g.arrow(s, w, frame_id=i6)
    g.arrow(fail, r, frame_id=i6)
    g.arrow(chip, a, frame_id=i6, color=CORAL)

    g.box(
        40,
        540,
        740,
        380,
        "Relayer trust — say this if asked, do not lead with it\n\nCCTP mint arrives at the vault with no “who sent it.”\nSo a permissioned relayer calls recordContribution.\n\nBOUNDED by an on-chain invariant:\n  token.balanceOf(vault)  ≥  totalEscrowed   always\n\nRelayer can mis-attribute a real deposit\n(wrong backer / wrong sourceDomain).\nRelayer CANNOT:\n  • conjure funds  • inflate raised past USDC in the vault\n  • drain the contract  • steal a refund\n\nMainnet path: CCTP v2 hook carries (campaignId, backer).",
        bg=WARN_BG,
        size=15,
        frame_id=i6,
    )
    g.box(
        820,
        540,
        700,
        380,
        "Refund rail\n\nSame-chain: backer calls refund, USDC on Arb.\nCross-chain: relayer (or backer) calls\nrefundCrossChain → CCTP burn back to\nthe stored sourceDomain.\n\nThis is why sourceDomain is stored per contribution.\nThe bar’s colors are not decoration — they are\nthe refund routing table.\n\n86 Foundry tests · invariant_solvency\nAudited twice · 0 Crit / High / Med",
        bg=OK_BG,
        size=15,
        frame_id=i6,
    )

    # ── 7 Circles machine ────────────────────────────────────────────────
    f7 = g.frame(fx(7), 0, FW, FH, "7 · Circles state machine")
    i7 = f7["id"]
    g.text(40, 24, "RotatingVault — the pot rotates, or everyone is refunded", size=30, font=FONT_HAND, frame_id=i7)

    cc = g.box(40, 120, 240, 110, "createCircle\nN seats · amount\nround length", bg=CARD, frame_id=i7)
    inv = g.box(320, 120, 240, 110, "EIP-712 invites\n(circle, member,\npayoutIndex, nonce)", bg=SPINE_BG, frame_id=i7)
    join = g.box(600, 120, 240, 110, "redeemInvite\nemail login =\nthat seat", bg=CIRCLES_BG, frame_id=i7)
    st = g.box(880, 120, 240, 110, "start\norganizer-gated\nrounds begin", bg=AMBER, frame_id=i7)
    dep = g.box(320, 320, 240, 110, "deposit / depositFor\nexactly amount\nthis round only", bg=CIRCLES_BG, frame_id=i7)
    pot = g.box(600, 320, 240, 110, "round full\npayee claims pot\nYou got the pot ✦", bg=OK_BG, frame_id=i7)
    rot = g.box(880, 320, 240, 110, "next round\nturn rotates\nuntil N pots paid", bg=OK_BG, frame_id=i7)
    brk = g.box(1160, 220, 340, 210, "Broken  (terminal)\nround window closed\nunder-funded\n\nrefund remaining deposits\nMoney's back ✦\n/circle/2 is this, live", bg=DANGER_BG, frame_id=i7)
    g.arrow(cc, inv, frame_id=i7)
    g.arrow(inv, join, frame_id=i7)
    g.arrow(join, st, frame_id=i7, label="N seated")
    g.arrow(st, dep, frame_id=i7)
    g.arrow(dep, pot, frame_id=i7, label="all N in")
    g.arrow(pot, rot, frame_id=i7)
    g.arrow(rot, dep, frame_id=i7, dashed=True, label="again")
    g.arrow(dep, brk, frame_id=i7, color=CORAL, label="someone flakes")

    g.box(
        40,
        500,
        740,
        420,
        "Safety properties (memorize)\n\n• A round pays the FULL pot or nobody. No partials.\n• refundable(m) = deposited(m) − claimedCount × amount\n• Already-paid pots stay paid. Early winner who later\n  defaults keeps winnings minus their deposits — same\n  as a real chit fund. Contract guarantee is narrower:\n  no unpaid-for pot, every still-held deposit refunds.\n• No organizer abort after start (can’t weaponize unwind).\n• Unclaimed pots on a healthy circle never expire.\n• Ownerless: there is no admin key. Period.",
        bg=OK_BG,
        size=15,
        frame_id=i7,
    )
    g.box(
        820,
        500,
        700,
        420,
        "Two organizer lanes (do not conflate)\n\nSELF-CUSTODY (real product)\n  createCircle from creator’s 7702 wallet\n  they sign every invite in the browser\n  only they can start\n  Rally server can only submit already-signed msgs\n\nDEMO FRIENDS (toggle on /circles/new)\n  Relayer is the on-chain organizer\n  so a solo pitch can mint invites on demand\n  UI discloses this. Judges will ask. Say it first.\n\nClaims are NEVER relayed — pot pays msg.sender.\nPayee claims gaslessly from their own email wallet.",
        bg=WARN_BG,
        size=15,
        frame_id=i7,
    )

    # ── 8 Trust & keys ───────────────────────────────────────────────────
    f8 = g.frame(fx(8), 0, FW, FH, "8 · Trust & keys")
    i8 = f8["id"]
    g.text(40, 24, "Who can do what — the honest board", size=34, font=FONT_HAND, frame_id=i8)

    g.box(
        40,
        110,
        360,
        380,
        "Deployer / relayer\n0x6A63…93B1\n\nGoalVault owner + relayer\nPays gas to mint + record\nDemo-circle organizer\nHolds Arb + Base ETH,\nArb USDC (~7.5)\n\nCannot steal Goals pots\n(withdraw = beneficiary)\nCannot touch Circles pots\n(ownerless vault)",
        bg=GOALS_BG,
        frame_id=i8,
    )
    g.box(
        430,
        110,
        360,
        380,
        "Dispenser treasury\n0x4F2C…F593\n\nDedicated faucet key.\nBase USDC (~17) + gas.\nGitHub-gated, 1 claim /\nwallet + GH account.\nAllowlist: ss251\n\nA bug here cannot touch\nthe relayer or vaults.\nThis is how empty email\nwallets get their first\ntestnet USDC.",
        bg=OK_BG,
        frame_id=i8,
    )
    g.box(
        820,
        110,
        360,
        380,
        "Backer (scripted)\n0xF0FE…D74F\n\nOP Sepolia USDC + ETH.\nUsed by demo/spike scripts\nto prove CCTP from OP.\n\nNot the Magic user.\nNot needed for the live\nemail demo if dispenser\nor a funded 7702 wallet\nis in play.",
        bg=CIRCLES_BG,
        frame_id=i8,
    )
    g.box(
        1210,
        110,
        310,
        380,
        "Gasless key\n0xe872…cE89\n\nValid key.\nZero balances today.\nSpike scripts only.\nDo not use in the pitch.",
        bg=NOTE_BG,
        frame_id=i8,
    )
    g.box(
        40,
        520,
        740,
        400,
        "Say out loud if a judge pokes the demo\n\n• Testnet only. Faucet USDC. No real money.\n• Magic OTP is human-in-the-browser. Not headless.\n• Fresh email wallets have no USDC — dispenser or\n  the disclosed relayer-front path covers the demo.\n• Relayer can mis-label a CCTP mint; it cannot steal.\n• Circles you create for real are self-custodied.\n  The “demo friends” toggle is us, labeled.\n• Attribution hook is the named mainnet follow-up.",
        bg=WARN_BG,
        size=16,
        frame_id=i8,
    )
    g.box(
        820,
        520,
        700,
        400,
        "What you do not need to open\n\n• Private keys (never paste, never screenshare)\n• Railway dashboard\n• Foundry / forge (86 tests already green)\n• ARBISCAN_API_KEY (verify-only)\n\nWhat you DO pre-open Friday\n• Landing  rally-production-94cc.up.railway.app\n• /c/1  /circle/1  /circle/2\n• Burn tx · mint tx · refund tx · both contracts",
        bg=CARD,
        size=16,
        frame_id=i8,
    )

    # ── 9 Pitch ──────────────────────────────────────────────────────────
    f9 = g.frame(fx(9), 0, FW, FH, "9 · Proof + 3-minute pitch")
    i9 = f9["id"]
    g.text(40, 24, "Friday 21 Aug 16:00 BST  ·  3 minutes  ·  one presenter", size=28, font=FONT_HAND, frame_id=i9)
    g.text(40, 70, "Practice: Tuesday 18 Aug 16:00 BST  ·  encodeclub.com/programmes/uxmaxx-hackathon/events/practice-pitch-for-finalists", size=14, color=MUTED, frame_id=i9)

    beats = [
        (40, 120, "0:00–0:20", "Open cold on the money", "Landing IS campaign #1.\n“This bar is not a mockup.”\nLive on Arbitrum pill."),
        (320, 120, "0:20–0:35", "The frame", "Conditional group money.\nPayPal shut the primitive.\nContract holds the pot."),
        (600, 120, "0:35–1:15", "Chip in LIVE", "Email. No wallet.\nYou're in ✦  Bar rises.\n“Burned on Base, ~10s, minted.”"),
        (880, 120, "1:15–1:30", "The switch", "Goals · Circles.\nSame promise, second shape.\nForeman replaced by a contract."),
        (1160, 120, "1:30–2:20", "Circle live", "/circle/1  last seat.\nClaim: You got the pot ✦\n“That’s a tx on Arbitrum.”"),
        (40, 380, "2:20–2:45", "The break", "/circle/2 broke on purpose.\nRefund already ran.\nShow the explorer tab."),
        (320, 380, "2:45–3:00", "Close", "Two shapes, one primitive.\nPassing a hat that pays out\ntogether — or hands it back."),
    ]
    for x, y, t, title, body in beats:
        g.box(x, y, 260, 220, f"{t}\n{title}\n\n{body}", bg=CARD, size=14, frame_id=i9)

    g.box(
        600,
        380,
        440,
        220,
        "Live receipts (pre-open)\n\n/c/1  landing hero\nBase burn  0x297eb6…\nArb mint   0xc354c2…\n/circle/1  mid-rotation\n/circle/2  refund 0xdb9d1d…",
        bg=OK_BG,
        size=15,
        frame_id=i9,
    )
    g.box(
        1080,
        380,
        440,
        220,
        "If wifi dies\n\nRecorded happy-path video.\n/circle/2 needs no fallback —\nit already happened.\nLanding still reads public RPC.\nDemo-fill last circle seat\nonly if you say so.",
        bg=WARN_BG,
        size=15,
        frame_id=i9,
    )
    g.box(
        40,
        640,
        1480,
        280,
        "The 60-second version (if they cut you)\n\n“One link. A bar that fills itself from every chain. It pays out together, or refunds everyone — automatically. That’s Rally.”\n1. Landing is a live escrow. Every color is a different chain. Nobody bridged.   2. Email, amount, You’re in ✦ — burned on Base, attested ~10s, minted on Arb.\n3. Switch to Circles. /circle/1 rotating live. /circle/2 we broke on purpose; the refund tx is already public.\n4. The primitive PayPal abandoned, plus the world’s largest informal instrument, with a pot nobody can walk off with.",
        bg=GOALS_BG,
        size=16,
        font=FONT_HAND,
        frame_id=i9,
    )

    return g.dump()


def main() -> None:
    data = build()
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {OUT}  elements={len(data['elements'])}")


if __name__ == "__main__":
    main()
