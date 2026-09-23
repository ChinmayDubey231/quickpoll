import type { ReactElement } from "react";
import { motion, useReducedMotion, type Transition, type Variants } from "framer-motion";

// Animated nav icons. Each icon is stroke-based SVG drawn in currentColor so it
// inherits the link's active/idle colour, and each one replays a short flourish
// whenever `active` flips — that's the tab-change animation.

export type NavIconName = "dashboard" | "create" | "discover" | "logout";

interface NavIconProps {
  name: NavIconName;
  active?: boolean;
  size?: number;
  className?: string;
}

const ease = [0.22, 1, 0.36, 1] as const;
const backOut = [0.34, 1.56, 0.64, 1] as const;
const pop: Transition = { duration: 0.5, ease };

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ---------------------------------- grid --------------------------------- */

const gridContainer: Variants = {
  idle: {},
  active: { transition: { staggerChildren: 0.07 } },
};

const gridTile: Variants = {
  idle: { scale: 1, rotate: 0, fillOpacity: 0 },
  active: {
    scale: [0.5, 1.18, 1],
    rotate: [-14, 6, 0],
    fillOpacity: [0, 0.22, 0.18],
    transition: pop,
  },
};

const tiles: Array<[number, number]> = [
  [3.25, 3.25],
  [13.25, 3.25],
  [3.25, 13.25],
  [13.25, 13.25],
];

function DashboardIcon() {
  return (
    <>
      {tiles.map(([x, y]) => (
        <motion.rect
          key={`${x}-${y}`}
          variants={gridTile}
          x={x}
          y={y}
          width={7.5}
          height={7.5}
          rx={2.2}
          {...strokeProps}
          fill="currentColor"
        />
      ))}
    </>
  );
}

/* --------------------------------- create -------------------------------- */

// The ring sweeps itself into existence (drawing while it rotates, so the pen
// travels), then the two arms of the plus shoot out from the centre — across
// first, then down — each overshooting slightly before settling.

const ringVariants: Variants = {
  idle: { pathLength: 1, rotate: 0, scale: 1 },
  active: {
    pathLength: [0, 1],
    rotate: [-130, 0],
    scale: [0.72, 1.07, 1],
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] },
  },
};

const armTransition: Transition = { duration: 0.44, ease: backOut };

const hArmVariants: Variants = {
  idle: { scaleX: 1 },
  active: { scaleX: [0, 1], transition: { ...armTransition, delay: 0.16 } },
};

const vArmVariants: Variants = {
  idle: { scaleY: 1 },
  active: { scaleY: [0, 1], transition: { ...armTransition, delay: 0.26 } },
};

function CreateIcon() {
  return (
    <>
      <motion.circle variants={ringVariants} cx={12} cy={12} r={9} {...strokeProps} />
      <motion.path variants={hArmVariants} d="M7.7 12h8.6" {...strokeProps} />
      <motion.path variants={vArmVariants} d="M12 7.7v8.6" {...strokeProps} />
    </>
  );
}

/* -------------------------------- discover ------------------------------- */

// A compass needle hunting for north: it whips round, decelerates, overshoots
// the mark, swings back and settles — and the north bead flashes as it lands.
// Everything stays inside the 24x24 box: the needle only rotates, and the ring,
// bead and body scale are kept small enough that no stroke reaches the edge.

const compassBodyVariants: Variants = {
  idle: { scale: 1 },
  active: { scale: [0.93, 1.03, 1], transition: pop },
};

// The spin track is offset to land on 0, not 360, so it ends on the same value
// `idle` holds — otherwise deselecting the tab unwinds the needle 360 degrees
// back. Starting at -360 is visually identical to 0, so entering still reads as
// a clean forward spin.
const needleVariants: Variants = {
  idle: { rotate: 0, scale: 1 },
  active: {
    rotate: [-360, -240, -60, 32, -16, 6, 0],
    scale: [0.86, 0.96, 1, 1, 1, 1, 1],
    transition: {
      duration: 0.9,
      times: [0, 0.2, 0.42, 0.62, 0.78, 0.9, 1],
      ease: ["easeIn", "linear", "easeOut", "easeInOut", "easeInOut", "easeOut"],
    },
  },
};

const northBeadVariants: Variants = {
  idle: { scale: 1, opacity: 0.45 },
  active: {
    scale: [1, 1.35, 1],
    opacity: [0.45, 1, 0.45],
    transition: { duration: 0.45, delay: 0.6, ease },
  },
};

function DiscoverIcon() {
  return (
    <motion.g variants={compassBodyVariants}>
      <rect width={24} height={24} fill="none" />
      <circle cx={12} cy={12} r={9} {...strokeProps} />
      <motion.circle variants={northBeadVariants} cx={12} cy={5.1} r={1.15} fill="currentColor" />
      <motion.g variants={needleVariants}>
        <rect width={24} height={24} fill="none" />
        <path
          d="M15.9 8.1 13.7 13.7 8.1 15.9 10.3 10.3Z"
          {...strokeProps}
          fill="currentColor"
          fillOpacity={0.22}
        />
      </motion.g>
    </motion.g>
  );
}

/* --------------------------------- logout -------------------------------- */

function LogoutIcon() {
  return (
    <>
      <path d="M14.5 4.5H17a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-2.5" {...strokeProps} />
      <g className="transition-transform duration-300 ease-out group-hover:translate-x-[2.5px]">
        <path d="M9.5 8.5 6 12l3.5 3.5" {...strokeProps} />
        <path d="M6 12h8" {...strokeProps} />
      </g>
    </>
  );
}

/* ---------------------------------- root --------------------------------- */

const icons: Record<NavIconName, () => ReactElement> = {
  dashboard: DashboardIcon,
  create: CreateIcon,
  discover: DiscoverIcon,
  logout: LogoutIcon,
};

export default function NavIcon({ name, active = false, size = 20, className = "" }: NavIconProps) {
  const reduceMotion = useReducedMotion();
  const Icon = icons[name];

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={`relative shrink-0 overflow-hidden ${className}`}
      variants={name === "dashboard" ? gridContainer : undefined}
      initial={false}
      animate={active && !reduceMotion ? "active" : "idle"}
    >
      <Icon />
    </motion.svg>
  );
}
