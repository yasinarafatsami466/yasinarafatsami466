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

const response = await fetch('https://api.github.com/graphql', {
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

if (!response.ok) {
  throw new Error(`GitHub API error: ${response.status}`);
}

const json = await response.json();

if (json.errors) {
  throw new Error(
    json.errors.map(error => error.message).join('; ')
  );
}

const weeks =
  json.data?.user?.contributionsCollection
    ?.contributionCalendar?.weeks;

if (!weeks?.length) {
  throw new Error('No contribution data returned');
}


/* =========================================================
   GRAPH
========================================================= */

const rows = 7;
const cols = weeks.length;

const cell = 11;
const gap = 3;
const step = cell + gap;

const left = 34;
const top = 30;
const right = 35;
const bottom = 30;

const width = left + cols * step + right;
const height = top + rows * step + bottom;


/* =========================================================
   COLORS
========================================================= */

function contributionColor(count) {
  if (count >= 15) return '#39d353';
  if (count >= 8) return '#26a641';
  if (count >= 3) return '#006d32';
  return '#0e4429';
}


/* =========================================================
   COLLECT CONTRIBUTIONS
========================================================= */

const contributions = [];

for (let x = 0; x < cols; x++) {
  const days = weeks[x]?.contributionDays || [];

  for (let y = 0; y < rows; y++) {
    const count = days[y]?.contributionCount || 0;

    const px = left + x * step;
    const py = top + y * step;

    if (count > 0) {
      contributions.push({
        x: px + cell / 2,
        y: py + cell / 2,
        count,
        color: contributionColor(count)
      });
    }
  }
}


/* =========================================================
   CELLS
========================================================= */

const cellSvg = [];

let contributionIndex = 0;

for (let x = 0; x < cols; x++) {
  const days = weeks[x]?.contributionDays || [];

  for (let y = 0; y < rows; y++) {
    const count = days[y]?.contributionCount || 0;

    const px = left + x * step;
    const py = top + y * step;

    if (count === 0) {
      cellSvg.push(`
<rect x="${px}" y="${py}" width="${cell}" height="${cell}"
rx="2.5" fill="#161b22" stroke="#30363d" stroke-width="0.4"/>`);
    } else {
      const c = contributionColor(count);

      cellSvg.push(`
<rect id="c${contributionIndex}"
x="${px}" y="${py}"
width="${cell}" height="${cell}"
rx="2.5" fill="${c}">
<animate
attributeName="opacity"
values="1;1;0;0;1"
keyTimes="0;0.02;0.04;0.98;1"
dur="${Math.max(7, contributions.length * 0.055)}s"
begin="${(contributionIndex * 0.055).toFixed(3)}s"
repeatCount="indefinite"/>
</rect>`);

      contributionIndex++;
    }
  }
}


/* =========================================================
   DRAGON PATH
========================================================= */

const points = [];

if (contributions.length > 0) {
  points.push({
    x: left - 45,
    y: contributions[0].y
  });

  for (let i = 0; i < contributions.length; i++) {
    const p = contributions[i];

    /*
      Small vertical offset makes the flight
      feel alive without rotating the dragon.
    */
    const wave =
      Math.sin(i * 0.9) * 5;

    points.push({
      x: p.x,
      y: p.y + wave
    });
  }

  points.push({
    x: left + cols * step + 45,
    y: contributions[contributions.length - 1].y
  });
} else {
  points.push(
    {
      x: left - 45,
      y: top + 42
    },
    {
      x: left + cols * step + 45,
      y: top + 42
    }
  );
}


/* =========================================================
   ANIMATION VALUES
========================================================= */

const total = points.length;

const values = points
  .map(p => `${p.x} ${p.y}`)
  .join(';');

const keyTimes = points
  .map((_, i) =>
    (i / (total - 1)).toFixed(4)
  )
  .join(';');

const animationDuration =
  Math.max(
    7,
    Math.min(
      18,
      contributions.length * 0.055
    )
  );


/* =========================================================
   DRAGON COLORS
========================================================= */

const dragonColors = [];

for (let i = 0; i < points.length; i++) {

  if (
    i > 0 &&
    i <= contributions.length
  ) {
    dragonColors.push(
      contributions[i - 1].color
    );
  } else {
    dragonColors.push('#39d353');
  }
}

const colorValues =
  dragonColors.join(';');


/* =========================================================
   DRAGON
========================================================= */

const dragon = `
<g id="dragon">

  <g id="dragon-art">

    <!-- TAIL -->

    <path
      d="M-7 0
         C-14 1 -21 3 -28 1
         C-35 -1 -41 -4 -47 0"
      fill="none"
      stroke="#39d353"
      stroke-width="3"
      stroke-linecap="round"
    />

    <path
      d="M-42 0 L-51 -5 L-48 0 L-51 5 L-42 3 Z"
      fill="#39d353"
    />


    <!-- BODY -->

    <ellipse
      cx="0"
      cy="0"
      rx="9"
      ry="5"
      fill="#39d353"
      stroke="#0e4429"
      stroke-width="0.8"
    />

    <ellipse
      cx="1"
      cy="-1"
      rx="5"
      ry="1.6"
      fill="#ffffff"
      opacity="0.2"
    />


    <!-- SPIKES -->

    <path
      d="M-5 -3
         L-8 -8
         L-1 -4
         L2 -9
         L5 -4
         L9 -7
         L10 -2 Z"
      fill="#39d353"
    />


    <!-- TOP WING -->

    <g>
      <path
        d="M-1 -2
           C-6 -11 -15 -17 -24 -13
           C-20 -8 -13 -3 -5 2 Z"
        fill="#39d353"
        stroke="#0e4429"
        stroke-width="0.8"
      />

      <animateTransform
        attributeName="transform"
        type="rotate"
        values="0 -2 0;-16 -2 0;0 -2 0;12 -2 0;0 -2 0"
        dur="0.7s"
        repeatCount="indefinite"
      />
    </g>


    <!-- BOTTOM WING -->

    <g>
      <path
        d="M-2 2
           C-7 10 -16 15 -24 11
           C-18 7 -12 3 -5 -2 Z"
        fill="#39d353"
        stroke="#0e4429"
        stroke-width="0.8"
      />

      <animateTransform
        attributeName="transform"
        type="rotate"
        values="0 -2 2;14 -2 2;0 -2 2;-11 -2 2;0 -2 2"
        dur="0.7s"
        repeatCount="indefinite"
      />
    </g>


    <!-- NECK -->

    <path
      d="M6 -1
         C9 -3 12 -3 14 -1
         L14 2
         C11 3 8 2 6 1 Z"
      fill="#39d353"
    />


    <!-- HEAD -->

    <path
      d="M8 0
         C12 -4 18 -4 22 0
         C18 4 12 4 8 0 Z"
      fill="#39d353"
      stroke="#0e4429"
      stroke-width="0.8"
    />


    <!-- SNOUT -->

    <path
      d="M18 -2 L28 0 L18 2 Z"
      fill="#39d353"
    />


    <!-- HORNS -->

    <path
      d="M11 -3 L12 -9 L16 -3 Z"
      fill="#26a641"
    />

    <path
      d="M8 -2 L5 -7 L12 -3 Z"
      fill="#26a641"
    />


    <!-- EYE -->

    <circle
      cx="19"
      cy="-1.2"
      r="1.2"
      fill="#f2cc60"
    />

    <circle
      cx="19.3"
      cy="-1.2"
      r="0.4"
      fill="#0d1117"
    />


    <!-- LEGS -->

    <path
      d="M5 3 L9 8 L12 8"
      fill="none"
      stroke="#39d353"
      stroke-width="1.4"
      stroke-linecap="round"
    />

    <path
      d="M-4 3 L-7 8 L-10 8"
      fill="none"
      stroke="#39d353"
      stroke-width="1.4"
      stroke-linecap="round"
    />


    <!-- COLOR CHANGES -->

    <animate
      attributeName="fill"
      values="${colorValues}"
      keyTimes="${keyTimes}"
      dur="${animationDuration}s"
      repeatCount="indefinite"
    />

  </g>


  <!-- WHOLE DRAGON MOVEMENT -->

  <animateTransform
    attributeName="transform"
    type="translate"
    values="${values}"
    keyTimes="${keyTimes}"
    dur="${animationDuration}s"
    repeatCount="indefinite"
    calcMode="linear"
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
role="img"
aria-label="Dragon contribution graph">

<rect
width="100%"
height="100%"
fill="#0d1117"/>

${cellSvg.join('')}

${dragon}

</svg>`;


/* =========================================================
   WRITE
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
  `🐉 Dragon SVG generated successfully (${contributions.length} contributions)`
);
