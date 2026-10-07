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

const cell = 12;
const gap = 3;
const step = cell + gap;

const left = 36;
const top = 30;

const width =
  left + cols * step + 36;

const height =
  top + rows * step + 30;

/* =========================
   CONTRIBUTION CELLS
========================= */

const cells = [];

for (let x = 0; x < cols; x++) {

  const days =
    weeks[x]?.contributionDays || [];

  for (let y = 0; y < rows; y++) {

    const px =
      left + x * step;

    const py =
      top + y * step;

    const count =
      days[y]?.contributionCount || 0;

    /* Empty cell */

    cells.push(`
<rect
  x="${px}"
  y="${py}"
  width="${cell}"
  height="${cell}"
  rx="2.5"
  fill="#1f2937"
  opacity="0.18"
/>`);

    /* Contribution cell */

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
  rx="2.5"
  fill="#22c55e"
  opacity="${opacity.toFixed(2)}"
/>`);
    }
  }
}

/* =========================
   DRAGON FLIGHT SETTINGS
========================= */

/*
   Dragon travels LEFT → RIGHT.

   The path has very small vertical
   movements to make the flight
   feel natural.
*/

const flightY =
  top + (rows * step) / 2;

const startX =
  left - 65;

const endX =
  left + cols * step + 65;

const flightDistance =
  endX - startX;

/*
   Flight speed.

   Increase this number for slower
   movement.
*/

const duration =
  Math.max(
    18,
    flightDistance * 0.055
  );

/* =========================
   DRAGON
========================= */

/*
   The entire dragon is ONE group.

   This prevents the body from
   breaking or bending during flight.
*/

const dragon = `
<g id="dragon">

  <!-- =====================
       TAIL
  ====================== -->

  <g id="tail">

    <path
      d="
        M -9 0
        C -16 1, -23 3, -29 1
        C -34 -1, -39 -3, -45 0
      "
      fill="none"
      stroke="#111827"
      stroke-width="3.8"
      stroke-linecap="round"
    />

    <path
      d="
        M -39 0
        L -47 -4
        L -44 0
        L -48 4
        L -40 3
        Z
      "
      fill="#111827"
    />

    <!-- Small natural tail movement -->

    <animateTransform
      attributeName="transform"
      type="rotate"
      values="
        0 0 0;
        1.8 0 0;
        0 0 0;
        -1.8 0 0;
        0 0 0
      "
      dur="1.4s"
      repeatCount="indefinite"
    />

  </g>

  <!-- =====================
       BODY
  ====================== -->

  <g id="body">

    <ellipse
      cx="0"
      cy="0"
      rx="8"
      ry="4.6"
      fill="#111827"
      stroke="#374151"
      stroke-width="0.8"
    />

    <ellipse
      cx="1"
      cy="-1"
      rx="4.5"
      ry="1.7"
      fill="#4b5563"
      opacity="0.65"
    />

    <!-- Very small body movement -->

    <animateTransform
      attributeName="transform"
      type="translate"
      values="
        0 0;
        0 -0.7;
        0 0.5;
        0 -0.5;
        0 0
      "
      dur="1.4s"
      repeatCount="indefinite"
    />

  </g>

  <!-- =====================
       TOP WING
  ====================== -->

  <g id="top-wing">

    <path
      d="
        M -2 -1
        C -7 -10, -14 -14, -21 -10
        C -16 -9, -11 -5, -5 2
        Z
      "
      fill="#374151"
      stroke="#111827"
      stroke-width="0.9"
    />

    <!-- Smooth wing flap -->

    <animateTransform
      attributeName="transform"
      type="rotate"
      values="
        0 -3 0;
        -12 -3 0;
        0 -3 0;
        8 -3 0;
        0 -3 0
      "
      dur="1.15s"
      repeatCount="indefinite"
    />

  </g>

  <!-- =====================
       LOWER WING
  ====================== -->

  <g id="bottom-wing">

    <path
      d="
        M -3 1
        C -8 9, -15 12, -21 8
        C -15 8, -10 4, -5 -2
        Z
      "
      fill="#374151"
      stroke="#111827"
      stroke-width="0.9"
    />

    <!-- Smooth opposite flap -->

    <animateTransform
      attributeName="transform"
      type="rotate"
      values="
        0 -3 1;
        10 -3 1;
        0 -3 1;
        -8 -3 1;
        0 -3 1
      "
      dur="1.15s"
      repeatCount="indefinite"
    />

  </g>

  <!-- =====================
       HEAD
  ====================== -->

  <g id="head">

    <!-- Head -->

    <path
      d="
        M 5 0
        C 9 -3.5, 15 -3.5, 19 0
        C 15 3.5, 9 3.5, 5 0
        Z
      "
      fill="#111827"
      stroke="#374151"
      stroke-width="0.8"
    />

    <!-- Snout -->

    <path
      d="
        M 15 -2
        L 24 0
        L 15 2
        Z
      "
      fill="#111827"
    />

    <!-- Horn -->

    <path
      d="
        M 8 -3
        L 10 -8
        L 13 -3
        Z
      "
      fill="#374151"
    />

    <path
      d="
        M 5 -2
        L 3 -7
        L 9 -3
        Z
      "
      fill="#374151"
    />

    <!-- Eye -->

    <circle
      cx="16"
      cy="-1.2"
      r="1"
      fill="#facc15"
    />

    <circle
      cx="16.2"
      cy="-1.2"
      r="0.35"
      fill="#111827"
    />

  </g>

  <!-- =====================
       WHOLE DRAGON FLIGHT
  ====================== -->

  <!--
       Small floating motion:
       LEFT → RIGHT

       Only the position changes.
       The dragon itself does NOT rotate.
  -->

  <animateTransform
    attributeName="transform"
    type="translate"

    values="
      ${startX} ${flightY};
      ${startX + flightDistance * 0.20} ${flightY - 2};
      ${startX + flightDistance * 0.40} ${flightY + 1.5};
      ${startX + flightDistance * 0.60} ${flightY - 1.5};
      ${startX + flightDistance * 0.80} ${flightY + 1};
      ${endX} ${flightY}
    "

    dur="${duration.toFixed(2)}s"

    repeatCount="indefinite"

    calcMode="spline"

    keySplines="
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1
    "

    keyTimes="
      0;
      0.20;
      0.40;
      0.60;
      0.80;
      1
    "
  />

</g>
`;

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

  ${dragon}

</svg>`;

/* =========================
   WRITE FILE
========================= */

fs.writeFileSync(
  'dragon.svg',
  svg,
  'utf8'
);

console.log(
  `Dragon SVG generated successfully (${cols} weeks)`
);
