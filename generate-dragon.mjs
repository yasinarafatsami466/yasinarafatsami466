import fs from "node:fs";

const username = process.env.GITHUB_USERNAME || process.argv[2];
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  throw new Error("GITHUB_USERNAME and GITHUB_TOKEN are required.");
}

const query = `
query($login:String!) {
  user(login:$login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            contributionLevel
          }
        }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "dragon-contribution-graph"
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username
    }
  })
});

if (!response.ok) {
  throw new Error(`GitHub API HTTP ${response.status}`);
}

const json = await response.json();

if (json.errors?.length) {
  throw new Error(
    json.errors.map(error => error.message).join("; ")
  );
}

const calendar =
  json.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar) {
  throw new Error(
    `GitHub user "${username}" not found or contributions unavailable.`
  );
}

const weeks = calendar.weeks;

const cols = weeks.length;
const rows = 7;

/*
 * Smaller graph cells
 */
const cell = 14;
const gap = 4;
const step = cell + gap;

const left = 46;
const top = 36;

const width = left + cols * step + 18;
const height = top + rows * step + 36;

const colors = {
  NONE: "#161b22",
  FIRST_QUARTILE: "#0e4429",
  SECOND_QUARTILE: "#006d32",
  THIRD_QUARTILE: "#26a641",
  FOURTH_QUARTILE: "#39d353"
};

const escapeXml = value =>
  String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[character]));

/*
 * ---------------------------------------------------------
 * CONTRIBUTION CELLS
 * ---------------------------------------------------------
 */

const cells = [];

for (let x = 0; x < cols; x++) {
  for (let y = 0; y < rows; y++) {
    const day = weeks[x]?.contributionDays?.[y];

    if (day) {
      cells.push({
        x,
        y,
        ...day
      });
    }
  }
}

/*
 * ---------------------------------------------------------
 * NATURAL SNAKE PATH
 * ---------------------------------------------------------
 *
 * Instead of making the dragon follow hard 90-degree corners,
 * we create a smoother path through the contribution cells.
 */

const points = [];

for (let x = 0; x < cols; x++) {
  const ys =
    x % 2 === 0
      ? [...Array(rows).keys()]
      : [...Array(rows).keys()].reverse();

  for (const y of ys) {
    points.push([
      left + x * step + cell / 2,
      top + y * step + cell / 2
    ]);
  }
}

/*
 * Create a smooth Catmull-Rom style SVG path.
 *
 * This keeps the dragon movement flowing instead of
 * making it snap around every 90-degree corner.
 */
function createSmoothPath(points) {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2) {
    return `
      M ${points[0][0]} ${points[0][1]}
      L ${points[1][0]} ${points[1][1]}
    `;
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;

    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += `
      C
      ${cp1x.toFixed(2)} ${cp1y.toFixed(2)},
      ${cp2x.toFixed(2)} ${cp2y.toFixed(2)},
      ${p2[0]} ${p2[1]}
    `;
  }

  return d.replace(/\s+/g, " ").trim();
}

const path = createSmoothPath(points);

/*
 * ---------------------------------------------------------
 * ANIMATION
 * ---------------------------------------------------------
 */

const duration = Math.max(
  30,
  points.length * 0.12
);

/*
 * ---------------------------------------------------------
 * MONTH LABELS
 * ---------------------------------------------------------
 */

const monthLabels = [];

let lastMonth = "";

for (let x = 0; x < cols; x++) {
  const date =
    weeks[x]?.contributionDays?.[0]?.date;

  if (!date) continue;

  const month =
    new Date(date + "T00:00:00Z")
      .toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC"
      });

  if (month !== lastMonth) {
    monthLabels.push(`
      <text
        x="${left + x * step}"
        y="20"
        class="month"
      >
        ${month}
      </text>
    `);

    lastMonth = month;
  }
}

/*
 * ---------------------------------------------------------
 * CONTRIBUTION SQUARES
 * ---------------------------------------------------------
 */

const rects = [];

for (const day of cells) {
  const x = left + day.x * step;
  const y = top + day.y * step;

  const level =
    colors[day.contributionLevel] ||
    colors.NONE;

  const index =
    day.x * rows +
    (
      day.x % 2 === 0
        ? day.y
        : rows - 1 - day.y
    );

  const begin =
    (index / points.length) * duration;

  const eatAnimation =
    day.contributionCount > 0
      ? `
        <animate
          attributeName="opacity"
          dur="${duration.toFixed(2)}s"
          repeatCount="indefinite"
          values="1;1;0;0;1"
          keyTimes="
            0;
            ${(begin / duration).toFixed(5)};
            ${((begin + 0.38) / duration).toFixed(5)};
            0.99999;
            1
          "
        />
      `
      : "";

  rects.push(`
    <rect
      x="${x}"
      y="${y}"
      width="${cell}"
      height="${cell}"
      rx="3"
      fill="${level}"
      stroke="#0d1117"
      stroke-width="1"
    >
      <title>
        ${escapeXml(day.date)}
        —
        ${day.contributionCount}
        contribution${day.contributionCount === 1 ? "" : "s"}
      </title>

      ${eatAnimation}
    </rect>
  `);
}

/*
 * ---------------------------------------------------------
 * DRAGON BODY SEGMENTS
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 *
 * The dragon is NOT one giant SVG group anymore.
 *
 * Every body segment follows the same path with a different
 * delay.
 *
 * This creates:
 *
 * HEAD → NECK → BODY → TAIL
 *
 * Each part follows the previous part naturally.
 */

const bodySegments = [];

const segmentCount = 13;

/*
 * Small → large → small.
 *
 * This gives the dragon a real tapered body.
 */
const segmentSizes = [
  5.0,
  5.3,
  5.5,
  5.7,
  5.8,
  5.7,
  5.5,
  5.2,
  4.9,
  4.5,
  4.0,
  3.4,
  2.5
];

for (let i = 0; i < segmentCount; i++) {
  const size = segmentSizes[i];

  /*
   * Each segment is delayed behind the head.
   *
   * Larger delay = further back.
   */
  const delay =
    -(i + 1) * 0.24;

  const xScale =
    1.55 - i * 0.025;

  bodySegments.push(`
    <g
      class="dragon-segment"
      opacity="${1 - i * 0.025}"
    >

      <!-- Main body -->
      <ellipse
        cx="0"
        cy="0"
        rx="${(size * xScale).toFixed(2)}"
        ry="${size.toFixed(2)}"
        fill="${i < 4 ? "#435534" : "#3f4f2f"}"
        stroke="#26351f"
        stroke-width="0.8"
      />

      <!-- Belly -->
      <ellipse
        cx="0"
        cy="${(size * 0.38).toFixed(2)}"
        rx="${(size * xScale * 0.72).toFixed(2)}"
        ry="${(size * 0.26).toFixed(2)}"
        fill="#71804b"
        opacity="0.9"
      />

      <!-- Back spike -->
      ${
        i % 2 === 0
          ? `
            <path
              d="
                M ${(-size * 0.45).toFixed(2)} ${(-size * 0.55).toFixed(2)}
                L 0 ${(-size * 1.55).toFixed(2)}
                L ${(size * 0.45).toFixed(2)} ${(-size * 0.55).toFixed(2)}
                Z
              "
              fill="#596b3b"
              stroke="#26351f"
              stroke-width="0.7"
            />
          `
          : ""
      }

      <animateMotion
        dur="${duration.toFixed(2)}s"
        begin="${delay.toFixed(2)}s"
        repeatCount="indefinite"
        rotate="auto"
        path="${path}"
      />

    </g>
  `);
}

/*
 * ---------------------------------------------------------
 * TAIL
 * ---------------------------------------------------------
 */

const tail = `
<g>

  <path
    d="
      M -3 0
      C -8 -1 -13 -3 -18 -1
      L -27 -6
      L -22 0
      L -28 5
      C -20 4 -12 3 -4 2
      Z
    "
    fill="#52643a"
    stroke="#26351f"
    stroke-width="1"
  />

  <animateMotion
    dur="${duration.toFixed(2)}s"
    begin="-3.35s"
    repeatCount="indefinite"
    rotate="auto"
    path="${path}"
  />

</g>
`;

/*
 * ---------------------------------------------------------
 * DRAGON HEAD
 * ---------------------------------------------------------
 *
 * Smaller than the previous version.
 */

const head = `
<g>

  <!-- Neck -->
  <path
    d="
      M -9 4
      C -5 1 -2 -4 2 -9
    "
    fill="none"
    stroke="#3f4f2f"
    stroke-width="7"
    stroke-linecap="round"
  />

  <!-- Head -->
  <path
    d="
      M 0 -13
      C 4 -19 11 -22 18 -19
      L 28 -15
      L 37 -10
      L 29 -5
      L 18 -5
      C 9 -6 3 -9 0 -13
      Z
    "
    fill="#3f4f2f"
    stroke="#26351f"
    stroke-width="1.2"
  />

  <!-- Lower jaw -->
  <path
    d="
      M 17 -6
      L 35 -10
      L 28 -3
      L 16 -3
      Z
    "
    fill="#52643a"
    stroke="#26351f"
    stroke-width="0.8"
  />

  <!-- Eye -->
  <path
    d="
      M 10 -15
      Q 14 -18 18 -15
      Q 14 -12 10 -14
      Z
    "
    fill="#151a10"
  />

  <!-- Golden eye -->
  <path
    d="
      M 12 -15
      L 16 -15
    "
    stroke="#d6a928"
    stroke-width="1.5"
    stroke-linecap="round"
  />

  <!-- Horn -->
  <path
    d="
      M 7 -18
      L 4 -27
      L 11 -20
      Z
    "
    fill="#b7aa82"
    stroke="#70654b"
    stroke-width="0.8"
  />

  <path
    d="
      M 15 -20
      L 16 -29
      L 21 -20
      Z
    "
    fill="#b7aa82"
    stroke="#70654b"
    stroke-width="0.8"
  />

  <!-- Teeth -->
  <path
    d="
      M 23 -6
      L 25 -2
      L 27 -6
      L 29 -3
    "
    fill="#eee9d8"
  />

  <!-- Nostril -->
  <circle
    cx="33"
    cy="-12"
    r="1"
    fill="#151a10"
  />

  <!-- Small wing -->
  <path
    d="
      M -2 -10
      L -9 -25
      L -2 -21
      L -4 -31
      L 4 -23
      L 9 -27
      L 8 -12
      Z
    "
    fill="#34452a"
    stroke="#202b1a"
    stroke-width="1"
  />

  <!-- Fire -->
  <path
    d="
      M 36 -10
      C 43 -14 48 -11 54 -14
      C 50 -8 45 -6 37 -7
    "
    fill="#d97706"
    stroke="#f59e0b"
    stroke-width="1"
  />

  <path
    d="
      M 42 -10
      C 47 -10 50 -9 53 -11
    "
    fill="none"
    stroke="#facc15"
    stroke-width="1"
  />

  <!-- Head follows the path -->
  <animateMotion
    dur="${duration.toFixed(2)}s"
    repeatCount="indefinite"
    rotate="auto"
    path="${path}"
  />

</g>
`;

/*
 * ---------------------------------------------------------
 * FINAL SVG
 * ---------------------------------------------------------
 */

const svg = `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

<style>

.month {
  fill: #8b949e;
  font: 11px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.title {
  fill: #f0f6fc;
  font: 700 16px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.sub {
  fill: #8b949e;
  font: 11px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.dragon-segment {
  transform-origin: center;
}

</style>

<!-- Background -->
<rect
  width="100%"
  height="100%"
  rx="12"
  fill="#0d1117"
/>

<!-- Title -->
<text
  x="${left}"
  y="14"
  class="title"
>
  🐉 Dragon Contribution Journey
</text>

<!-- Total contributions -->
<text
  x="${width - 16}"
  y="14"
  text-anchor="end"
  class="sub"
>
  ${calendar.totalContributions} contributions
</text>

<!-- Months -->
${monthLabels.join("")}

<!-- Contribution Graph -->
<g>
${rects.join("")}
</g>

<!-- Dragon -->
<g id="dragon">

  <!-- Tail -->
  ${tail}

  <!-- Body -->
  ${bodySegments.join("")}

  <!-- Head -->
  ${head}

</g>

<!-- Footer -->
<text
  x="${left}"
  y="${height - 10}"
  class="sub"
>
  Every contribution powers the dragon ⚡
</text>

</svg>
`;

fs.mkdirSync("dragon", {
  recursive: true
});

fs.writeFileSync(
  "dragon/dragon.svg",
  svg
);

console.log(
  `🐉 Generated Dragon graph for ${username}`
);

console.log(
  `Total contributions: ${calendar.totalContributions}`
);    variables: {
      login: username
    }
  })
});

if (!response.ok) {
  throw new Error(`GitHub API HTTP ${response.status}`);
}

const json = await response.json();

if (json.errors?.length) {
  throw new Error(
    json.errors.map(error => error.message).join("; ")
  );
}

const calendar =
  json.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar) {
  throw new Error(
    `GitHub user "${username}" not found or contributions unavailable.`
  );
}

const weeks = calendar.weeks;

const cols = weeks.length;
const rows = 7;

const cell = 14;
const gap = 4;
const step = cell + gap;

const left = 46;
const top = 36;

const width = left + cols * step + 18;
const height = top + rows * step + 36;

const colors = {
  NONE: "#161b22",
  FIRST_QUARTILE: "#0e4429",
  SECOND_QUARTILE: "#006d32",
  THIRD_QUARTILE: "#26a641",
  FOURTH_QUARTILE: "#39d353"
};

const escapeXml = value =>
  String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[character]));

const cells = [];

for (let x = 0; x < cols; x++) {
  for (let y = 0; y < rows; y++) {
    const day = weeks[x]?.contributionDays?.[y];

    if (day) {
      cells.push({
        x,
        y,
        ...day
      });
    }
  }
}

/*
 * Create a snake-like path through every contribution square.
 */
const points = [];

for (let x = 0; x < cols; x++) {
  const ys =
    x % 2 === 0
      ? [...Array(rows).keys()]
      : [...Array(rows).keys()].reverse();

  for (const y of ys) {
    points.push([
      left + x * step + cell / 2,
      top + y * step + cell / 2
    ]);
  }
}

const path = points
  .map((point, index) =>
    `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`
  )
  .join(" ");

const duration = Math.max(
  28,
  points.length * 0.11
);

/*
 * Month labels
 */
const monthLabels = [];

let lastMonth = "";

for (let x = 0; x < cols; x++) {
  const date =
    weeks[x]?.contributionDays?.[0]?.date;

  if (!date) continue;

  const month =
    new Date(date + "T00:00:00Z")
      .toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC"
      });

  if (month !== lastMonth) {
    monthLabels.push(`
      <text
        x="${left + x * step}"
        y="20"
        class="month"
      >
        ${month}
      </text>
    `);

    lastMonth = month;
  }
}

/*
 * Contribution squares
 */
const rects = [];

for (const day of cells) {
  const x = left + day.x * step;
  const y = top + day.y * step;

  const level =
    colors[day.contributionLevel] ||
    colors.NONE;

  const index =
    day.x * rows +
    (
      day.x % 2 === 0
        ? day.y
        : rows - 1 - day.y
    );

  const begin =
    (index / points.length) * duration;

  const eatAnimation =
    day.contributionCount > 0
      ? `
        <animate
          attributeName="opacity"
          dur="${duration.toFixed(2)}s"
          repeatCount="indefinite"
          values="1;1;0;0;1"
          keyTimes="
            0;
            ${(begin / duration).toFixed(5)};
            ${((begin + 0.38) / duration).toFixed(5)};
            0.99999;
            1
          "
        />
      `
      : "";

  rects.push(`
    <rect
      x="${x}"
      y="${y}"
      width="${cell}"
      height="${cell}"
      rx="3"
      fill="${level}"
      stroke="#0d1117"
      stroke-width="1"
    >
      <title>
        ${escapeXml(day.date)}
        —
        ${day.contributionCount}
        contribution${day.contributionCount === 1 ? "" : "s"}
      </title>

      ${eatAnimation}
    </rect>
  `);
}

/*
 * 🐉 Natural Serpentine Dragon
 */
const dragon = `
<g id="dragon">

  <!-- Long snake-like dragon body -->
  <path
    d="M-5 5
       C-18 -4 -28 12 -40 4
       C-52 -5 -62 12 -74 4
       C-86 -4 -96 10 -108 3"
    fill="none"
    stroke="#3f4f2f"
    stroke-width="10"
    stroke-linecap="round"
  />

  <!-- Lighter natural belly -->
  <path
    d="M-7 5
       C-18 0 -28 9 -40 4
       C-52 0 -62 9 -74 4
       C-86 1 -96 8 -108 3"
    fill="none"
    stroke="#71804b"
    stroke-width="3"
    stroke-linecap="round"
  />

  <!-- Neck -->
  <path
    d="M0 5
       C3 -5 8 -12 15 -16"
    fill="none"
    stroke="#3f4f2f"
    stroke-width="9"
    stroke-linecap="round"
  />

  <!-- Dragon head -->
  <path
    d="M12 -17
       C16 -25 25 -29 34 -25
       L45 -20
       L55 -14
       L45 -8
       L32 -8
       C22 -9 15 -12 12 -17 Z"
    fill="#3f4f2f"
    stroke="#26351f"
    stroke-width="1.5"
  />

  <!-- Lower jaw -->
  <path
    d="M30 -9
       L52 -13
       L43 -5
       L28 -5 Z"
    fill="#52643a"
    stroke="#26351f"
    stroke-width="1"
  />

  <!-- Sharp eye -->
  <path
    d="M24 -20
       Q29 -23 34 -20
       Q29 -16 24 -18 Z"
    fill="#151a10"
  />

  <!-- Golden eye -->
  <path
    d="M27 -20
       L32 -20"
    stroke="#d6a928"
    stroke-width="2"
    stroke-linecap="round"
  />

  <!-- Horn 1 -->
  <path
    d="M19 -23
       L14 -34
       L23 -26 Z"
    fill="#b7aa82"
    stroke="#70654b"
    stroke-width="1"
  />

  <!-- Horn 2 -->
  <path
    d="M29 -25
       L29 -36
       L35 -26 Z"
    fill="#b7aa82"
    stroke="#70654b"
    stroke-width="1"
  />

  <!-- Teeth -->
  <path
    d="M38 -9
       L40 -4
       L43 -9
       L46 -5"
    fill="#eee9d8"
  />

  <!-- Nostril -->
  <circle
    cx="49"
    cy="-17"
    r="1.4"
    fill="#151a10"
  />

  <!-- Dragon wing -->
  <path
    d="M5 -13
       L-6 -33
       L3 -27
       L0 -41
       L10 -30
       L17 -35
       L16 -16 Z"
    fill="#34452a"
    stroke="#202b1a"
    stroke-width="1.5"
  />

  <!-- Back spikes -->
  <path
    d="M-5 0
       L-10 -9
       L-2 -4

       M-20 1
       L-25 -8
       L-17 -3

       M-35 2
       L-40 -7
       L-32 -2

       M-50 3
       L-55 -6
       L-47 0"
    fill="#596b3b"
    stroke="#26351f"
    stroke-width="1"
  />

  <!-- Tail -->
  <path
    d="M-100 3
       L-117 -3
       L-108 8 Z"
    fill="#52643a"
  />

  <!-- Fire breath -->
  <path
    d="M53 -14
       C62 -18 67 -13 74 -16
       C69 -9 63 -8 55 -10"
    fill="#d97706"
    stroke="#f59e0b"
    stroke-width="1.5"
  />

  <!-- Inner fire -->
  <path
    d="M60 -14
       C66 -14 69 -11 73 -13"
    fill="none"
    stroke="#facc15"
    stroke-width="1.5"
  />

</g>
`;

/*
 * Final SVG
 */
const svg = `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

<style>

.month {
  fill: #8b949e;
  font: 11px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.title {
  fill: #f0f6fc;
  font: 700 16px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.sub {
  fill: #8b949e;
  font: 11px -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

</style>

<!-- Background -->
<rect
  width="100%"
  height="100%"
  rx="12"
  fill="#0d1117"
/>

<!-- Title -->
<text
  x="${left}"
  y="14"
  class="title"
>
  🐉 Dragon Contribution Journey
</text>

<!-- Total contributions -->
<text
  x="${width - 16}"
  y="14"
  text-anchor="end"
  class="sub"
>
  ${calendar.totalContributions} contributions
</text>

<!-- Months -->
${monthLabels.join("")}

<!-- Contribution Graph -->
<g>
${rects.join("")}
</g>

<!-- Dragon -->
${dragon.replace(
  "</g>",
  `
    <animateMotion
      dur="${duration.toFixed(2)}s"
      repeatCount="indefinite"
      rotate="auto"
      path="${path}"
    />
  </g>
  `
)}

<!-- Footer -->
<text
  x="${left}"
  y="${height - 10}"
  class="sub"
>
  Every contribution powers the dragon ⚡
</text>

</svg>
`;

fs.mkdirSync("dragon", {
  recursive: true
});

fs.writeFileSync(
  "dragon/dragon.svg",
  svg
);

console.log(
  `🐉 Generated Dragon graph for ${username}`
);

console.log(
  `Total contributions: ${calendar.totalContributions}`
);
