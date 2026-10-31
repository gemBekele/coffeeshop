import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type NavIconName =
  | "home"
  | "cup"
  | "menu"
  | "settings"
  | "card"
  | "person";

/**
 * Line icons for the bottom bar. Drawn as SVG paths so they stay crisp at any
 * density without adding an icon font (the SVG runtime is already bundled).
 */
export function NavIcon({
  name,
  color,
  size = 24,
}: {
  name: NavIconName;
  color: string;
  size?: number;
}) {
  const stroke = 1.8;
  const common = {
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" ? (
        <>
          <Path d="M3.5 10.5 12 3.5l8.5 7" {...common} />
          <Path d="M5.8 9.6V20h12.4V9.6" {...common} />
          <Path d="M10 20v-5h4v5" {...common} />
        </>
      ) : null}

      {name === "cup" ? (
        <>
          <Path d="M5 8.5h11v6.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8.5Z" {...common} />
          <Path d="M16 10h1.8a2.6 2.6 0 0 1 0 5.2H16" {...common} />
          <Path d="M8.5 3.5v2M12 3.5v2" {...common} />
        </>
      ) : null}

      {name === "menu" ? (
        <>
          <Path d="M4 7h16M4 12h16M4 17h10" {...common} />
        </>
      ) : null}

      {name === "settings" ? (
        <>
          <Path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" {...common} />
          <Circle cx={15} cy={7.5} r={2.2} {...common} />
          <Circle cx={9} cy={16.5} r={2.2} {...common} />
        </>
      ) : null}

      {name === "card" ? (
        <>
          <Rect x={3} y={5.5} width={18} height={13} rx={2.5} {...common} />
          <Path d="M3 10h18" {...common} />
          <Path d="M6.5 14.5h4" {...common} />
        </>
      ) : null}

      {name === "person" ? (
        <>
          <Circle cx={12} cy={8} r={3.4} {...common} />
          <Path d="M5.5 20c.9-3.4 3.5-5.2 6.5-5.2s5.6 1.8 6.5 5.2" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
