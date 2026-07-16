import Bunny from "./Bunny";

/**
 * A player's display name, plus any personal flair — Emily's name is
 * always accompanied by her black lop-eared bunny.
 */
export default function PlayerName({
  name,
  bunnySize = "1.1em",
}: {
  name: string;
  bunnySize?: number | string;
}) {
  return (
    <>
      {name}
      {name === "Emily" && <Bunny size={bunnySize} />}
    </>
  );
}
