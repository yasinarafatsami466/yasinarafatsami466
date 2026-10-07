import fs from 'fs';

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  throw new Error('Missing GITHUB_USERNAME or GITHUB_TOKEN');
}

const query = `
query($login:String!) {
  user(login:$login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
          }
        }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'dragon-contribution-generator'
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username
    }
  })
});

if (!res.ok) {
  throw new Error(`GitHub API error: ${res.status}`);
}

const json = await res.json();

if (json.errors) {
  throw new Error(
    json.errors.map(e => e.message).join('; ')
  );
}

const weeks =
  json.data?.user?.contributionsCollection
    ?.contributionCalendar?.weeks;

if (!weeks?.length) {
  throw new Error('No contribution data returned');
}

/* =========================
   GRAPH SETTINGS
========================= */

const rows = 7;
const cols = weeks.length;

const cell = 14;
const gap = 4;
const step = cell + gap;

const left = 42;
const top = 32;

const width = left + cols * step + 42;
const height = top + rows * step + 34;

/* =========================
   CONTRIBUTION CELLS
========================= */

const points = [];
const cells = [];

for (let x = 0; x < cols; x++) {

  const days =
    weeks[x]?.contributionDays || [];

  const order =
    x % 2 === 0
      ? [0, 1, 2, 3, 4, 5, 6]
      : [6, 5, 4, 3, 2, 1, 0];

  for (const y of order) {

    const px = left + x * step;
    const py = top + y * step;

    const count =
      days[y]?.contributionCount || 0;

    points.push([
      px + cell / 2,
      py + cell / 2
    ]);

    cells.push(`
<rect
  x="${px}"
  y="${py}"
  width="${cell}"
  height="${cell}"
  rx="3"
  fill="#1f2937"
  opacity="0.18"
/>`);

    if (count > 0) {

      const opacity =
        Math.min(
          0.35 + count * 0.05,
          0.95
        );

      cells.push(`
<rect
  x="${px}"
  y="${py}"
  width="${cell}"
  height="${cell}"
  rx="3"
  fill="#22c55e"
  opacity="${opacity.toFixed(2)}"
/>`);
    }
  }
}

/* =========================
   SMOOTH PATH
========================= */

function smoothPath(p) {

  if (p.length < 2) {
    return '';
  }

  let d =
    `M ${p[0][0]} ${p[0][1]}`;

  for (
    let i = 1;
    i < p.length - 1;
    i++
  ) {

    const mx =
      (p[i][0] + p[i + 1][0]) / 2;

    const my =
      (p[i][1] + p[i + 1][1]) / 2;

    d +=
      ` Q ${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }

  const last =
    p[p.length - 1];

  d +=
    ` Q ${last[0]} ${last[1]} ${last[0]} ${last[1]}`;

  return d;
}

const path =
  smoothPath(points);

/* =========================
   ANIMATION
========================= */

const duration =
  Math.max(
    30,
    points.length * 0.105
  );

/* =========================
   DRAGON
========================= */

const dragon = [];

/* BODY */

for (
  let i = 16;
  i >= 0;
  i--
) {

  const scale =
    1 - i / 16;

  const rx =
    7.8 - scale * 2.0;

  const ry =
    4.8 - scale * 1.2;

  const delay =
    i * 0.052;

  dragon.push(`
<g>

  <ellipse
    cx="0"
    cy="0"
    rx="${rx.toFixed(1)}"
    ry="${ry.toFixed(1)}"
    fill="#111827"
    stroke="#374151"
    stroke-width="1"
  />

  <ellipse
    cx="1"
    cy="-1"
    rx="${(rx * 0.58).toFixed(1)}"
    ry="${(ry * 0.4).toFixed(1)}"
    fill="#4b5563"
    opacity="0.7"
  />

  <animateMotion
    dur="${duration.toFixed(2)}s"
    begin="-${delay.toFixed(3)}s"
    repeatCount="indefinite"
    rotate="auto"
    calcMode="paced"
    path="${path}"
  />

</g>`);
}

/* WINGS */

dragon.push(`
<g>

  <path
    d="M0 0
       C-10 -13 -21 -13 -27 -5
       C-18 -7 -10 -3 -4 4 Z"
    fill="#374151"
    stroke="#111827"
    stroke-width="1.2"
  />

  <path
    d="M-3 2
       C-13 13 -22 12 -27 6
       C-18 8 -10 4 -4 -3 Z"
    fill="#374151"
    stroke="#111827"
    stroke-width="1.2"
  />

  <animateMotion
    dur="${duration.toFixed(2)}s"
    begin="-0.45s"
    repeatCount="indefinite"
    rotate="auto"
    calcMode="paced"
    path="${path}"
  />

</g>`);

/* TAIL */

dragon.push(`
<g>

  <path
    d="M2 0
       C-9 1 -17 5 -25 2
       C-32 -1 -38 -4 -45 0"
    fill="none"
    stroke="#111827"
    stroke-width="5.8"
    stroke-linecap="round"
  />

  <path
    d="M-40 0
       L-49 -6
       L-46 0
       L-51 6
       L-42 4 Z"
    fill="#111827"
  />

  <animateMotion
    dur="${duration.toFixed(2)}s"
    begin="-1.05s"
    repeatCount="indefinite"
    rotate="auto"
    calcMode="paced"
    path="${path}"
  />

</g>`);

/* HEAD */

dragon.push(`
<g>

  <path
    d="M0 0
       C6 -5 14 -5 20 0
       C14 5 6 5 0 0 Z"
    fill="#111827"
    stroke="#374151"
    stroke-width="1.2"
  />

  <path
    d="M15 -3
       L27 0
       L15 3 Z"
    fill="#111827"
  />

  <path
    d="M7 -4
       L11 -11
       L14 -4 Z"
    fill="#374151"
  />

  <path
    d="M3 -3
       L0 -9
       L8 -4 Z"
    fill="#374151"
  />

  <circle
    cx="17"
    cy="-1.5"
    r="1.35"
    fill="#facc15"
  />

  <circle
    cx="17.3"
    cy="-1.5"
    r="0.5"
    fill="#111827"
  />

  <animateMotion
    dur="${duration.toFixed(2)}s"
    repeatCount="indefinite"
    rotate="auto"
    calcMode="paced"
    path="${path}"
  />

</g>`);

/* =========================
   FINAL SVG
========================= */

const svg = `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

${cells.join('\n')}

${dragon.join('\n')}

</svg>`;

fs.writeFileSync(
  'dragon.svg',
  svg,
  'utf8'
);

console.log(
  `Dragon SVG generated successfully (${points.length} points)`
);
