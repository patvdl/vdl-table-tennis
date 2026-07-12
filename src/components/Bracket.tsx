import { Link } from "react-router-dom";
import type { EnrichedMatch } from "../types";
import { roundLabel, type BracketNode } from "../lib/bracket";

/**
 * Visual single-elimination bracket, final on the right.
 * Rendered recursively from the derived bracket tree; players who entered
 * on a bye get a dimmed "bye" slot so the columns line up like a real draw.
 */

function PlayerRow({
  name,
  isWinner,
  score,
}: {
  name: string;
  isWinner: boolean;
  score?: string | null;
}) {
  return (
    <div className={`bk-row ${isWinner ? "win" : "lose"}`}>
      <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
        {name}
      </Link>
      {isWinner && score && <span className="bk-score">{score}</span>}
      {isWinner && <span className="bk-check">✓</span>}
    </div>
  );
}

export function MatchBox({ match, label }: { match: EnrichedMatch; label?: string }) {
  return (
    <div className="bk-match">
      {label && <div className="bk-tag">{label}</div>}
      <PlayerRow name={match.player1} isWinner={match.winner === 1} score={match.score} />
      <PlayerRow name={match.player2} isWinner={match.winner === 2} score={match.score} />
    </div>
  );
}

function ByeSlot({ name }: { name: string }) {
  return (
    <div className="bk-match bk-bye">
      <div className="bk-row win">
        <Link className="player-link" to={`/player/${encodeURIComponent(name)}`}>
          {name}
        </Link>
      </div>
      <div className="bk-row lose" style={{ fontStyle: "italic" }}>
        bye
      </div>
    </div>
  );
}

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
