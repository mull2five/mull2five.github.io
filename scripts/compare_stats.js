import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BskyAgent } from '@atproto/api';
import yaml from 'js-yaml';

const DATA_DIR = '_data/player_info';
const PLAYERS_YML = '_data/players.yml';
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;
const DRY_RUN = !BLUESKY_PASSWORD || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const POST_LIMIT = 295;
const MAX_SELECTED_PLAYERS = 3;

const HANDLES = {
    UNITY: "@unityleaguemtg.bsky.social",
    MTGA: "@mtgarena.com"
};

const REPLACEMENTS = {
    [HANDLES.UNITY]: "EUL",
    [HANDLES.MTGA]: "MTGA"
};

const MTGA_RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
const SCORE_MULTIPLIERS = {
    ELO: 100,
    WIN_RATE: 50,
    UNITY_RANK: 10,
    UNITY_POINTS: 1,
    MTGA_RANK: 50
};

let playersConfig = [];
try {
    playersConfig = yaml.load(fs.readFileSync(PLAYERS_YML, 'utf8'));
} catch (e) {
    console.warn(`Could not load ${PLAYERS_YML}, using defaults.`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

const DEFAULT_TARGET = '1 week ago';
const argTarget = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const COMPARE_TARGET = resolveTarget(argTarget || DEFAULT_TARGET);

function resolveTarget(target) {
    try {
        // If it's a valid commit ID (SHA-1), return it as-is
        if (/^[0-9a-f]{7,40}$/i.test(target)) {
            return target;
        }

        // Use git rev-list to find the latest commit until the given date or description
        const resolved = execSync(`git rev-list -n 1 --until="${target}" HEAD`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        return resolved || 'HEAD~1';
    } catch (e) {
        return 'HEAD~1';
    }
}

async function run() {
    const movers = await collectPlayerMovers();

    if (movers.length === 0) {
        console.log("No significant positive movements found this week.");
        return;
    }

    movers.sort((a, b) => b.score - a.score);

    if (VERBOSE) {
        console.log(`Detailed Player Diffs (sorted by score):`);
        movers.forEach((m, i) => {
            console.log(`${i + 1}. ${m.name} (Score: ${m.score.toFixed(1)})\n   - ${m.diffs.join('\n   - ')}`);
        });
        console.log(`---`);
    }

    const timeDescription = getTimeDescription(COMPARE_TARGET);
    const postContent = generatePost(movers, timeDescription);

    if (!postContent) {
        console.log("No significant positive movements to report this week.");
        return;
    }

    console.log(`Generated Post:\n---\n${postContent}\n---`);

    if (DRY_RUN) {
        console.log("No BlueSky secret provided or --dry-run flag set. Skipping publishing.");
    } else {
        await publishToBluesky(postContent);
    }
}

function showHelp() {
    console.log(`
Weekly Player Stats Summary - Comparison & BlueSky Posting Tool

Usage:
  node scripts/compare_stats.js [TARGET] [FLAGS]

Arguments:
  TARGET        Git ref (commit hash, branch) or date string (e.g. "2026-04-01") 
                to compare against.
                Default: "1 week ago" (resolves to the closest commit)

Flags:
  --dry-run     Log the post to console and skip BlueSky publishing.
  --verbose     Log the diffs for all players sorted by their rank calculation score.
  --help, -h    Show this help message.

Example:
  node scripts/compare_stats.js 2026-04-01 --dry-run
    `);
}

async function collectPlayerMovers() {
    const players = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
    const movers = [];

    for (const playerFile of players) {
        const playerId = playerFile.replace('.json', '');
        const currentPath = path.join(DATA_DIR, playerFile);
        const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));

        const oldData = getHistoricalPlayerData(playerId, currentPath);
        if (!oldData) continue;

        const statsDiff = compareStats(playerId, currentData, oldData);
        if (statsDiff.hasImprovements) {
            movers.push(statsDiff);
        }
    }
    return movers;
}

function getHistoricalPlayerData(playerId, currentPath) {
    try {
        const gitPath = currentPath.replace(/\\/g, '/');
        const oldContent = execSync(`git show "${COMPARE_TARGET}":${gitPath}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        return JSON.parse(oldContent);
    } catch (e) {
        // Only attempt fallback if we are using the default target
        const isDefault = (COMPARE_TARGET === resolveTarget(DEFAULT_TARGET));
        if (!isDefault) {
            console.error(`Could not find data for ${playerId} at ${COMPARE_TARGET}.`);
            return null;
        }
        try {
            const oldContent = execSync(`git show HEAD~1:${currentPath}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            return JSON.parse(oldContent);
        } catch (e2) {
            console.log(`Could not find old data for ${playerId}, skipping comparison.`);
            return null;
        }
    }
}

function compareStats(playerId, current, old) {
    const context = {
        name: getDisplayName(playerId, current.general.name),
        diffs: [],
        score: 0
    };

    compareWinRate(current, old, context);
    compareElo(current, old, context);
    compareUnityLeague(current, old, context);
    compareMtgaRanks(current, old, context);

    return {
        playerId,
        name: context.name,
        diffs: context.diffs,
        score: context.score,
        hasImprovements: context.diffs.length > 0
    };
}

function compareWinRate(current, old, context) {
    const currWinRate = parseFloat(current.general?.["win rate"]);
    const oldWinRate = parseFloat(old.general?.["win rate"]);
    if (isNaN(currWinRate) || isNaN(oldWinRate) || currWinRate <= oldWinRate) return;

    const delta = (currWinRate - oldWinRate).toFixed(1);
    if (parseFloat(delta) > 0) {
        context.diffs.push(`boosted win rate by ${delta}% (now ${current.general["win rate"]})`);
        context.score += parseFloat(delta) * SCORE_MULTIPLIERS.WIN_RATE;
    }
}

function compareElo(current, old, context) {
    const currElo = current.sources?.["MTG Elo Project"]?.data;
    const oldElo = old.sources?.["MTG Elo Project"]?.data;
    if (!currElo || !oldElo) return;

    const currRating = parseInt(currElo.current_rating);
    const oldRating = parseInt(oldElo.current_rating);
    if (!isNaN(currRating) && !isNaN(oldRating) && currRating > oldRating) {
        const delta = currRating - oldRating;
        context.diffs.push(`gained ${delta} #MTGElo points (now ${currRating})`);
        context.score += delta * SCORE_MULTIPLIERS.ELO;
    }
}

function compareUnityLeague(current, old, context) {
    const currUnity = current.sources?.["Unity League"]?.data;
    const oldUnity = old.sources?.["Unity League"]?.data;
    if (!currUnity || !oldUnity) return;

    const currRank = parseInt(currUnity["rank germany"]);
    const oldRank = parseInt(oldUnity["rank germany"]);
    if (!isNaN(currRank) && !isNaN(oldRank) && currRank < oldRank) {
        const delta = oldRank - currRank;
        context.diffs.push(`climbed ${delta} spots in ${HANDLES.UNITY} (now 🇩🇪${currRank})`);
        context.score += delta * SCORE_MULTIPLIERS.UNITY_RANK;
    }

    const currPoints = parseInt(currUnity["rank points"]);
    const oldPoints = parseInt(oldUnity["rank points"]);
    if (!isNaN(currPoints) && !isNaN(oldPoints) && currPoints > oldPoints) {
        const delta = currPoints - oldPoints;
        context.diffs.push(`gained ${delta} ${HANDLES.UNITY} points`);
        context.score += delta * SCORE_MULTIPLIERS.UNITY_POINTS;
    }
}

function compareMtgaRanks(current, old, context) {
    const mtgaSources = ["Untapped.gg", "general"];
    for (const type of ["constructed", "limited"]) {
        let currRank, oldRank;
        for (const src of mtgaSources) {
            currRank = (src === "Untapped.gg")
                ? current.sources?.[src]?.data?.mtga_rank?.[type]
                : current.general?.mtga_rank?.[type];
            oldRank = (src === "Untapped.gg")
                ? old.sources?.[src]?.data?.mtga_rank?.[type]
                : old.general?.mtga_rank?.[type];
            if (currRank && oldRank) break;
        }

        if (currRank && oldRank && currRank !== oldRank && isBetterMtgaRank(currRank, oldRank)) {
            context.diffs.push(`reached ${currRank} in ${HANDLES.MTGA} ${type}`);
            context.score += SCORE_MULTIPLIERS.MTGA_RANK;
        }
    }
}

function getDisplayName(playerId, fullName) {
    const player = playersConfig.find(p => p.id === playerId);
    const handle = player?.social_media?.bluesky;
    if (handle) {
        return `@${handle}`;
    }

    // Fallback: Name truncation (e.g., "John Doe" -> "John D.")
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
        const firstNames = parts.slice(0, -1).join(' ');
        const lastNameInitial = parts[parts.length - 1][0];
        return `${firstNames} ${lastNameInitial}.`;
    }
    return fullName;
}

function isBetterMtgaRank(curr, old) {
    const getRankValue = (r) => {
        if (!r) return -1;
        const [tier, num] = r.split(' ');
        const base = MTGA_RANKS.indexOf(tier);
        if (base === -1) return -1;
        const level = num ? (5 - parseInt(num)) : 0;
        return base * 10 + level;
    };
    return getRankValue(curr) > getRankValue(old);
}

function getTimeDescription(target) {
    const isDefault = (target === resolveTarget(DEFAULT_TARGET));
    if (isDefault) {
        return "the last 7 days";
    }
    try {
        const dateStr = execSync(`git show -s --format=%ci "${target}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const now = new Date();
            const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return "today";
            if (diffDays === 1) return "the last 24 hours";
            return `the last ${diffDays} days`;
        }
    } catch (e) {
        // Fallback for non-git targets or errors
    }
    return "the last week";
}

function generatePost(movers, timeDescription) {
    const header = `📈 Movers of ${timeDescription}:\n\n`;
    const medals = ["🥇", "🥈", "🥉"];

    const selectedMovers = movers.slice(0, Math.min(movers.length, MAX_SELECTED_PLAYERS));
    const playerDiffs = selectedMovers.map(m => ({
        name: m.name,
        all: [...m.diffs],
        used: []
    }));

    distributeDiffs(playerDiffs, header, medals);

    const body = assemblePostBody(playerDiffs, header, medals);
    if (!body) return null;

    return header + body;
}

function distributeDiffs(playerDiffs, header, medals) {
    // Strategy 1: Baseline (best diff for everyone)
    // We try to add the first diff for everyone, but if a player's line is so long
    // it exceeds the limit even for just the first diff, we have to skip that diff
    // to avoid ellipsing.
    for (let i = 0; i < playerDiffs.length; i++) {
        if (playerDiffs[i].all.length > 0) {
            if (estimateLength(header, playerDiffs, medals, i, playerDiffs[i].all[0]) <= POST_LIMIT) {
                playerDiffs[i].used.push(playerDiffs[i].all.shift());
            } else {
                // If even the first diff doesn't fit, skip it entirely
                playerDiffs[i].all.shift();
            }
        }
    }

    // Strategy 2 & 3: 2nd best diff for 1st and 2nd player
    for (let i = 0; i < 2; i++) {
        if (!playerDiffs[i] || playerDiffs[i].all.length === 0) continue;

        // Priority check for Strategy 3: only if 1st player is "done" with level 2
        // (Either they have 2 diffs or they have no more diffs to show)
        if (i === 1 && playerDiffs[0].used.length < 2 && playerDiffs[0].all.length > 0) continue;

        if (estimateLength(header, playerDiffs, medals, i, playerDiffs[i].all[0]) <= POST_LIMIT) {
            playerDiffs[i].used.push(playerDiffs[i].all.shift());
        }
    }

    // Strategy 4, 5, 6: Remaining diffs in order
    for (let i = 0; i < playerDiffs.length; i++) {
        while (playerDiffs[i].all.length > 0) {
            // Cannot give player i more diffs if player i-1 still has pending diffs
            if (i > 0 && playerDiffs[i - 1].all.length > 0) break;

            if (estimateLength(header, playerDiffs, medals, i, playerDiffs[i].all[0]) <= POST_LIMIT) {
                playerDiffs[i].used.push(playerDiffs[i].all.shift());
            } else {
                break;
            }
        }
    }
}

function estimateLength(header, playerDiffs, medals, targetIdx = -1, nextDiff = null) {
    const tempDiffs = playerDiffs.map((p, i) => {
        const used = [...p.used];
        if (i === targetIdx && nextDiff) used.push(nextDiff);
        return { name: p.name, used };
    });
    return (header + assemblePostBody(tempDiffs, header, medals)).length;
}

function assemblePostBody(playerDiffs, header, medals) {
    let body = "";
    const state = {
        seenHandles: new Set(),
        seenShorts: new Set()
    };

    for (let i = 0; i < playerDiffs.length; i++) {
        const medal = medals[i] || "•";
        const player = playerDiffs[i];

        if (player.used.length === 0) {
            body += `${medal} ${player.name}\n`;
            continue;
        }

        const processedDiffs = player.used.map(diff =>
            processDiffText(diff, state, player)
        );

        let diffStr = processedDiffs.join(', ');
        body += `${medal} ${player.name} ${diffStr}\n`;
    }
    return body;
}

function processDiffText(text, state, player) {
    let processed = text;
    const seenInLine = new Set();

    for (const [handle, short] of Object.entries(REPLACEMENTS)) {
        if (!processed.includes(handle)) continue;

        const hasFullHandle = processed.includes(handle);
        if (state.seenHandles.has(handle)) {
            let replacement = short;
            if (!state.seenShorts.has(short)) {
                replacement = `#${short}`;
                state.seenShorts.add(short);
            }
            processed = processed.split(handle).join(replacement);
        } else {
            state.seenHandles.add(handle);
        }

        const shortWithHash = `#${short}`;
        const usedShort = (processed.includes(shortWithHash) || (!processed.includes(handle) && (short === "EUL" || short === "MTGA"))) ? shortWithHash : short;

        if (seenInLine.has(short) || seenInLine.has(shortWithHash)) {
            processed = removeRedundantPlatform(processed, usedShort);
        } else {
            seenInLine.add(usedShort);
        }
    }

    return handleEloHashtag(processed, state);
}

function removeRedundantPlatform(text, short) {
    return text
        .split(` ${short} `).join(' ')
        .split(` ${short}`).join('')
        .split(`${short},`).join(',')
        .trim();
}

function handleEloHashtag(text, state) {
    const shortElo = "MTGElo";
    const hashElo = "#MTGElo";
    if (!text.includes(hashElo)) return text;

    if (state.seenShorts.has(shortElo)) {
        return text.split(hashElo).join(shortElo);
    } else {
        state.seenShorts.add(shortElo);
        return text;
    }
}

async function publishToBluesky(text) {
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    try {
        await agent.login({ identifier: BLUESKY_HANDLE, password: BLUESKY_PASSWORD });
        await agent.post({
            text: text,
            createdAt: new Date().toISOString()
        });
        console.log("Successfully posted to BlueSky!");
    } catch (e) {
        console.error("Failed to publish to BlueSky:", e.message);
        process.exit(1);
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
