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
