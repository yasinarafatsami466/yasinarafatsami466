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


/* =========================================================
   GRAPH SETTINGS
========================================================= */

const rows = 7;
const cols = weeks.length;

const cell = 11;
const gap = 3;
const step = cell + gap;

const left = 34;
const top = 30;

const right = 34;
const bottom = 34;

const width =
  left + cols * step + right;

const height =
  top + rows * step + bottom;


/* =========================================================
   CONTRIBUTION CELLS
========================================================= */

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


    /* -----------------------------------------------------
       EMPTY CELL
    ----------------------------------------------------- */

    if (count === 0) {

      cells.push(`
        <rect
          x="${px}"
          y="${py}"
          width="${cell}"
          height="${cell}"
          rx="2.5"
          fill="#161b22"
          stroke="#30363d"
          stroke-width="0.4"
        />
      `);

      continue;
    }


    /* -----------------------------------------------------
       CONTRIBUTION COLOR LEVELS
    ----------------------------------------------------- */

    let fill;

    if (count >= 15) {
      fill = '#39d353';
    } else if (count >= 8) {
      fill = '#26a641';
    } else if (count >= 3) {
      fill = '#006d32';
    } else {
      fill = '#0e4429';
    }


    cells.push(`
      <rect
        x="${px}"
        y="${py}"
        width="${cell}"
        height="${cell}"
        rx="2.5"
        fill="${fill}"
      />
    `);
  }
}


/* =========================================================
   DRAGON FLIGHT
========================================================= */

/*
   Dragon moves across the COMPLETE graph.

   Instead of a straight line, the dragon follows
   a gentle wave path.
*/

const startX = left - 55;
const endX = left + cols * step + 55;

const centerY =
  top + (rows * step) / 2;


/*
   Faster animation.
*/

const duration = 9;


/*
   Different points of the flight.
*/

const p1x = startX;
const p2x = startX + (endX - startX) * 0.14;
const p3x = startX + (endX - startX) * 0.28;
const p4x = startX + (endX - startX) * 0.42;
const p5x = startX + (endX - startX) * 0.56;
const p6x = startX + (endX - startX) * 0.70;
const p7x = startX + (endX - startX) * 0.84;
const p8x = endX;


/*
   Vertical wave.

   This makes the dragon move around
   the contribution graph instead of
   staying on one straight line.
*/

const y1 = centerY;
const y2 = centerY - 10;
const y3 = centerY + 7;
const y4 = centerY - 12;
const y5 = centerY + 10;
const y6 = centerY - 6;
const y7 = centerY + 8;
const y8 = centerY;


/* =========================================================
   DRAGON
========================================================= */

const dragon = `
<g id="dragon">

  <!-- =====================================================
       WHOLE DRAGON POSITION
       Only the whole dragon moves.
       Body NEVER rotates.
  ====================================================== -->

  <g id="dragon-body">

    <!-- =================================================
         TAIL
    ================================================== -->

    <path
      d="
        M -7 0
        C -14 1, -21 3, -28 1
        C -35 -1, -41 -4, -47 0
      "
      fill="none"
      stroke="#8b949e"
      stroke-width="3"
      stroke-linecap="round"
    />

    <path
      d="
        M -42 0
        L -51 -5
        L -48 0
        L -51 5
        L -42 3
        Z
      "
      fill="#6e7681"
    />


    <!-- =================================================
         BODY
    ================================================== -->

    <ellipse
      cx="0"
      cy="0"
      rx="9"
      ry="5"
      fill="#21262d"
      stroke="#8b949e"
      stroke-width="0.8"
    />

    <ellipse
      cx="1"
      cy="-1"
      rx="5"
      ry="1.7"
      fill="#8b949e"
      opacity="0.45"
    />


    <!-- =================================================
         BACK SPIKES
    ================================================== -->

    <path
      d="
        M -5 -3
        L -8 -8
        L -1 -4
        L 2 -9
        L 5 -4
        L 9 -7
        L 10 -2
        Z
      "
      fill="#30363d"
    />


    <!-- =================================================
         TOP WING
    ================================================== -->

    <g id="top-wing">

      <path
        d="
          M -1 -2
          C -6 -11, -15 -17, -24 -13
          C -20 -8, -13 -3, -5 2
          Z
        "
        fill="#30363d"
        stroke="#8b949e"
        stroke-width="0.8"
      />

      <!-- Wing flap ONLY -->
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="
          0 -2 0;
          -18 -2 0;
          0 -2 0;
          14 -2 0;
          0 -2 0
        "
        dur="0.75s"
        repeatCount="indefinite"
      />

    </g>


    <!-- =================================================
         BOTTOM WING
    ================================================== -->

    <g id="bottom-wing">

      <path
        d="
          M -2 2
          C -7 10, -16 15, -24 11
          C -18 7, -12 3, -5 -2
          Z
        "
        fill="#30363d"
        stroke="#8b949e"
        stroke-width="0.8"
      />

      <animateTransform
        attributeName="transform"
        type="rotate"
        values="
          0 -2 2;
          15 -2 2;
          0 -2 2;
          -12 -2 2;
          0 -2 2
        "
        dur="0.75s"
        repeatCount="indefinite"
      />

    </g>


    <!-- =================================================
         NECK
    ================================================== -->

    <path
      d="
        M 6 -1
        C 9 -3, 12 -3, 14 -1
        L 14 2
        C 11 3, 8 2, 6 1
        Z
      "
      fill="#21262d"
    />


    <!-- =================================================
         HEAD
    ================================================== -->

    <path
      d="
        M 8 0
        C 12 -4, 18 -4, 22 0
        C 18 4, 12 4, 8 0
        Z
      "
      fill="#21262d"
      stroke="#8b949e"
      stroke-width="0.8"
    />


    <!-- =================================================
         SNOUT
    ================================================== -->

    <path
      d="
        M 18 -2
        L 28 0
        L 18 2
        Z
      "
      fill="#21262d"
    />


    <!-- =================================================
         HORNS
    ================================================== -->

    <path
      d="
        M 11 -3
        L 12 -9
        L 16 -3
        Z
      "
      fill="#6e7681"
    />

    <path
      d="
        M 8 -2
        L 5 -7
        L 12 -3
        Z
      "
      fill="#6e7681"
    />


    <!-- =================================================
         EYE
    ================================================== -->

    <circle
      cx="19"
      cy="-1.2"
      r="1.25"
      fill="#f2cc60"
    />

    <circle
      cx="19.3"
      cy="-1.2"
      r="0.4"
      fill="#161b22"
    />


    <!-- =================================================
         FRONT LEG
    ================================================== -->

    <path
      d="
        M 5 3
        L 9 8
        L 12 8
      "
      fill="none"
      stroke="#8b949e"
      stroke-width="1.4"
      stroke-linecap="round"
    />


    <!-- =================================================
         BACK LEG
    ================================================== -->

    <path
      d="
        M -4 3
        L -7 8
        L -10 8
      "
      fill="none"
      stroke="#8b949e"
      stroke-width="1.4"
      stroke-linecap="round"
    />

  </g>


  <!-- =====================================================
       FLIGHT ANIMATION

       The whole dragon translates.
       It does NOT rotate.

       This prevents body deformation.
  ====================================================== -->

  <animateTransform
    attributeName="transform"
    type="translate"

    values="
      ${p1x} ${y1};
      ${p2x} ${y2};
      ${p3x} ${y3};
      ${p4x} ${y4};
      ${p5x} ${y5};
      ${p6x} ${y6};
      ${p7x} ${y7};
      ${p8x} ${y8}
    "

    dur="${duration}s"

    repeatCount="indefinite"

    calcMode="spline"

    keyTimes="
      0;
      0.14;
      0.28;
      0.42;
      0.56;
      0.70;
      0.84;
      1
    "

    keySplines="
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1;
      0.42 0 0.58 1
    "
  />

</g>
`;


/* =========================================================
   FINAL SVG
========================================================= */

const svg = `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

  <rect
    width="100%"
    height="100%"
    fill="#0d1117"
  />

  ${cells.join('\n')}

  ${dragon}

</svg>`;


/* =========================================================
   WRITE FILE
========================================================= */

fs.mkdirSync('dragon', {
  recursive: true
});

fs.writeFileSync(
  'dragon/dragon.svg',
  svg,
  'utf8'
);

console.log(
  `🐉 Dragon SVG generated successfully (${cols} weeks)`
);
