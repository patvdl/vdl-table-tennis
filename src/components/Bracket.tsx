import { Link } from "react-router-dom";
import type { EnrichedMatch } from "../types";
import { roundLabel, type BracketNode, type PlannedNode } from "../lib/bracket";
import PlayerName from "./PlayerName";

/**
 * Visual single-elimination bracket, final on the right.
 * Two variants share the same layout and styles:
 *  - <Bracket>        renders a derived tree (historical tournaments)
 *  - <PlannedBracket> renders a stored draw with live results, TBD slots
 *    for undecided rounds and dashed walkover boxes for byes.
 */

function NameOrTbd({ name }: { name: string | null }) {
  if (!name) return <span className="bk-tbd">TBD</span>;
  return (
    <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
      <PlayerName name={name} />
    </Link>
  );
}

function PlayerRow({
  name,
  isWinner,
  decided,
  score,
}: {
  name: string | null;
  isWinner: boolean;
  decided: boolean;
  score?: string | null;
}) {
  return (
    <div className={`bk-row ${decided ? (isWinner ? "win" : "lose") : ""}`}>
      <NameOrTbd name={name} />
      {isWinner && score && <span className="bk-score">{score}</span>}
      {isWinner && <span className="bk-check">✓</span>}
    </div>
  );
}

export function MatchBox({ match, label }: { match: EnrichedMatch; label?: string }) {
  return (
    <div className="bk-match">
      {label && <div className="bk-tag">{label}</div>}
      <PlayerRow name={match.player1} isWinner={match.winner === 1} decided score={match.score} />
      <PlayerRow name={match.player2} isWinner={match.winner === 2} decided score={match.score} />
    </div>
  );
}

function ByeSlot({ name }: { name: string | null }) {
  return (
    <div className="bk-match bk-bye">
      <div className="bk-row win">
        <NameOrTbd name={name} />
      </div>
      <div className="bk-row lose" style={{ fontStyle: "italic" }}>
        bye
      </div>
    </div>
  );
}

/* ---------------- derived bracket ---------------- */

function NodeView({ node, maxDepth }: { node: BracketNode; maxDepth: number }) {
  const { match, feed1, feed2 } = node;
  const hasFeeds = Boolean(feed1 || feed2);
  return (
    <div className="bk-node">
      {hasFeeds && (
        <div className="bk-feeds">
          <div className="bk-feed">
            {feed1 ? <NodeView node={feed1} maxDepth={maxDepth} /> : <ByeSlot name={match.player1} />}
          </div>
          <div className="bk-feed">
            {feed2 ? <NodeView node={feed2} maxDepth={maxDepth} /> : <ByeSlot name={match.player2} />}
          </div>
        </div>
      )}
      <div className={`bk-match-wrap ${hasFeeds ? "has-feeds" : ""}`}>
        <MatchBox match={match} label={roundLabel(node.depth, maxDepth)} />
      </div>
    </div>
  );
}

export default function Bracket({
  root,
  maxDepth,
  thirdPlaceMatch,
}: {
  root: BracketNode;
  maxDepth: number;
  thirdPlaceMatch: EnrichedMatch | null;
}) {
  return (
    <div className="bracket-scroll">
      <div className="bracket">
        <NodeView node={root} maxDepth={maxDepth} />
      </div>
      {thirdPlaceMatch && (
        <div className="bracket-third">
          <MatchBox match={thirdPlaceMatch} label="3rd place" />
        </div>
      )}
    </div>
  );
}

/* ---------------- planned bracket ---------------- */

function PlannedNodeView({ node, maxDepth }: { node: PlannedNode; maxDepth: number }) {
  const kids = [node.feed1, node.feed2].filter(
    (c): c is PlannedNode => Boolean(c && !c.isDead),
  );
  const decided = node.match !== null;
  return (
    <div className="bk-node">
      {kids.length > 0 && (
        <div className="bk-feeds">
          {kids.map((c, i) => (
            <div className="bk-feed" key={i}>
              <PlannedNodeView node={c} maxDepth={maxDepth} />
            </div>
          ))}
        </div>
      )}
      <div className={`bk-match-wrap ${kids.length ? "has-feeds" : ""}`}>
        {node.isContest ? (
          <div className="bk-match">
            <div className="bk-tag">{roundLabel(node.depth, maxDepth)}</div>
            <PlayerRow
              name={node.player1}
              isWinner={decided && node.match!.winnerName === node.player1}
              decided={decided}
              score={node.match?.score}
            />
            <PlayerRow
              name={node.player2}
              isWinner={decided && node.match!.winnerName === node.player2}
              decided={decided}
              score={node.match?.score}
            />
          </div>
        ) : (
          <ByeSlot name={node.winner} />
        )}
      </div>
    </div>
  );
}

export function PlannedBracket({
  root,
  maxDepth,
  thirdPlaceMatch,
  thirdPlacePending,
}: {
  root: PlannedNode;
  maxDepth: number;
  thirdPlaceMatch: EnrichedMatch | null;
  thirdPlacePending: [string, string] | null;
}) {
  return (
    <div className="bracket-scroll">
      <div className="bracket">
        <PlannedNodeView node={root} maxDepth={maxDepth} />
      </div>
      {thirdPlaceMatch && (
        <div className="bracket-third">
          <MatchBox match={thirdPlaceMatch} label="3rd place" />
        </div>
      )}
      {!thirdPlaceMatch && thirdPlacePending && (
        <div className="bracket-third">
          <div className="bk-match">
            <div className="bk-tag">3rd place — to be played</div>
            <div className="bk-row">
              <NameOrTbd name={thirdPlacePending[0]} />
            </div>
            <div className="bk-row">
              <NameOrTbd name={thirdPlacePending[1]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
