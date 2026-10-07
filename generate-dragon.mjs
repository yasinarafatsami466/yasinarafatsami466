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
 * 🐉 Dragon design
 */
const dragon = `
<g id="dragon">

  <!-- Body -->
  <ellipse
    cx="0"
    cy="4"
    rx="15"
    ry="10"
    fill="#7c3aed"
    stroke="#c4b5fd"
    stroke-width="1.5"
  />

  <!-- Head -->
  <circle
    cx="15"
    cy="-2"
    r="8"
    fill="#a855f7"
    stroke="#c4b5fd"
    stroke-width="1.5"
  />

  <!-- Eye -->
  <circle
    cx="18"
    cy="-5"
    r="2"
    fill="white"
  />

  <circle
    cx="18.5"
    cy="-5"
    r="1"
    fill="#111827"
  />

  <!-- Mouth -->
  <path
    d="M20 1 Q28 4 20 5"
    fill="#ef4444"
  />

  <!-- Wing -->
  <path
    d="M-4 -5 L-15 -18 L4 -12 Z"
    fill="#ec4899"
    stroke="#f9a8d4"
    stroke-width="1"
  />

  <!-- Tail -->
  <path
    d="M-4 7 Q-14 20 -24 9"
    fill="none"
    stroke="#ec4899"
    stroke-width="5"
    stroke-linecap="round"
  />

  <!-- Tail flame -->
  <path
    d="M-24 9 L-31 5 L-27 13 Z"
    fill="#f97316"
  />

  <!-- Fire -->
  <path
    d="M27 2 Q38 0 31 -7"
    fill="none"
    stroke="#f97316"
    stroke-width="3"
    stroke-linecap="round"
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
