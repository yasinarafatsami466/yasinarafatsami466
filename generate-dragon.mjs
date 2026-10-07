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
   CONTRIBUTION COLORS
========================================================= */

function getContributionColor(count) {

  if (count >= 15) {
    return '#39d353';
  }

  if (count >= 8) {
    return '#26a641';
  }

  if (count >= 3) {
    return '#006d32';
  }

  return '#0e4429';
}


/* =========================================================
   CONTRIBUTION CELLS
========================================================= */

const cells = [];

/*
   Store every contribution position.

   Dragon will visit these positions one by one.
*/

const contributionPoints = [];

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


    /* =====================================================
       EMPTY CELL
    ===================================================== */

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


    /* =====================================================
       CONTRIBUTION CELL
    ===================================================== */

    const contributionColor =
      getContributionColor(count);

    const index =
      contributionPoints.length;

    contributionPoints.push({
      x: px + cell / 2,
      y: py + cell / 2,
      count,
      color: contributionColor
    });

    cells.push(`
      <g id="contribution-${index}">

        <rect
          x="${px}"
          y="${py}"
          width="${cell}"
          height="${cell}"
          rx="2.5"
          fill="${contributionColor}"
        />

      </g>
    `);
  }
}


/* =========================================================
   DRAGON PATH
========================================================= */

/*
   If there are no contributions,
   dragon uses a simple path.
*/

let dragonPoints = contributionPoints;

if (dragonPoints.length === 0) {

  dragonPoints = [
    {
      x: left,
      y: top + (rows * step) / 2,
      color: '#39d353'
    },
    {
      x: left + cols * step,
      y: top + (rows * step) / 2,
      color: '#39d353'
    }
  ];
}


/* =========================================================
   ADD ENTRY + EXIT POINTS
========================================================= */

const startPoint = {
  x: left - 60,
  y: dragonPoints[0].y,
  color: dragonPoints[0].color
};

const endPoint = {
  x: left + cols * step + 60,
  y: dragonPoints[dragonPoints.length - 1].y,
  color: dragonPoints[dragonPoints.length - 1].color
};


/*
   Actual animation points.
*/

const flightPoints = [
  startPoint,
  ...dragonPoints,
  endPoint
];


/* =========================================================
   FLIGHT TIMING
========================================================= */

/*
   Faster overall animation.

   More contributions = slightly longer,
   but never extremely slow.
*/

const visitCount =
  contributionPoints.length;

const duration =
  Math.max(
    7,
    Math.min(
      18,
      visitCount * 0.045
    )
  );


/* =========================================================
   BUILD TRANSLATE VALUES
========================================================= */

const translateValues =
  flightPoints
    .map(point =>
      `${point.x} ${point.y}`
    )
    .join(';\n      ');


/* =========================================================
   KEY TIMES
========================================================= */

const totalPoints =
  flightPoints.length;

const keyTimes =
  flightPoints
    .map((_, index) => {

      const value =
        index / (totalPoints - 1);

      return value.toFixed(4);

    })
    .join(';\n      ');


/* =========================================================
   DRAGON COLOR ANIMATION
========================================================= */

/*
   Dragon changes color according to
   the contribution it is visiting.
*/

const colorValues =
  flightPoints
    .map(point => point.color)
    .join(';\n      ');


/* =========================================================
   DRAGON SIZE
========================================================= */

const dragonScale = 0.72;


/* =========================================================
   CONTRIBUTION DISAPPEAR ANIMATIONS
========================================================= */

/*
   Each contribution disappears when
   the dragon reaches it.

   The timing is synchronized with
   the dragon's position.
*/

const disappearAnimations = [];

for (
  let i = 0;
  i < contributionPoints.length;
  i++
) {

  /*
     Dragon starts at index 0.

     Contribution i is at flightPoints[i + 1]
     because startPoint is index 0.
  */

  const normalizedTime =
    (i + 1) / (totalPoints - 1);

  const beginTime =
    duration * normalizedTime;

  const disappearDuration =
    0.16;

  disappearAnimations.push(`
    <animate
      attributeName="opacity"
      values="1;1;0"
      keyTimes="0;0.35;1"
      dur="${disappearDuration}s"
      begin="${beginTime.toFixed(3)}s"
      fill="freeze"
    />
  `);
}


/* =========================================================
   DRAGON SVG
========================================================= */

const dragon = `
<g
  id="dragon"
  transform="scale(${dragonScale})"
>

  <!-- =====================================================
       DRAGON SHAPE
  ====================================================== -->

  <g id="dragon-shape">

    <!-- ===================================================
         TAIL
    ==================================================== -->

    <path
      d="
        M -7 0
        C -14 1, -21 3, -28 1
        C -35 -1, -41 -4, -47 0
      "
      fill="none"
      stroke="#39d353"
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
      fill="#39d353"
    />


    <!-- ===================================================
         BODY
    ==================================================== -->

    <ellipse
      cx="0"
      cy="0"
      rx="9"
      ry="5"
      fill="#39d353"
      stroke="#0e4429"
      stroke-width="0.9"
    />

    <ellipse
      cx="1"
      cy="-1"
      rx="5"
      ry="1.7"
      fill="#ffffff"
      opacity="0.22"
    />


    <!-- ===================================================
         BACK SPIKES
    ==================================================== -->

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
      fill="#39d353"
    />


    <!-- ===================================================
         TOP WING
    ==================================================== -->

    <g id="top-wing">

      <path
        d="
          M -1 -2
          C -6 -11, -15 -17, -24 -13
          C -20 -8, -13 -3, -5 2
          Z
        "
        fill="#39d353"
        stroke="#0e4429"
        stroke-width="0.8"
      />

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


    <!-- ===================================================
         BOTTOM WING
    ==================================================== -->

    <g id="bottom-wing">

      <path
        d="
          M -2 2
          C -7 10, -16 15, -24 11
          C -18 7, -12 3, -5 -2
          Z
        "
        fill="#39d353"
        stroke="#0e4429"
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


    <!-- ===================================================
         NECK
    ==================================================== -->

    <path
      d="
        M 6 -1
        C 9 -3, 12 -3, 14 -1
        L 14 2
        C 11 3, 8 2, 6 1
        Z
      "
      fill="#39d353"
    />


    <!-- ===================================================
         HEAD
    ==================================================== -->

    <path
      d="
        M 8 0
        C 12 -4, 18 -4, 22 0
        C 18 4, 12 4, 8 0
        Z
      "
      fill="#39d353"
      stroke="#0e4429"
      stroke-width="0.8"
    />


    <!-- ===================================================
         SNOUT
    ==================================================== -->

    <path
      d="
        M 18 -2
        L 28 0
        L 18 2
        Z
      "
      fill="#39d353"
    />


    <!-- ===================================================
         HORNS
    ==================================================== -->

    <path
      d="
        M 11 -3
        L 12 -9
        L 16 -3
        Z
      "
      fill="#26a641"
    />

    <path
      d="
        M 8 -2
        L 5 -7
        L 12 -3
        Z
      "
      fill="#26a641"
    />


    <!-- ===================================================
         EYE
    ==================================================== -->

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
      fill="#0d1117"
    />


    <!-- ===================================================
         FRONT LEG
    ==================================================== -->

    <path
      d="
        M 5 3
        L 9 8
        L 12 8
      "
      fill="none"
      stroke="#39d353"
      stroke-width="1.4"
      stroke-linecap="round"
    />


    <!-- ===================================================
         BACK LEG
    ==================================================== -->

    <path
      d="
        M -4 3
        L -7 8
        L -10 8
      "
      fill="none"
      stroke="#39d353"
      stroke-width="1.4"
      stroke-linecap="round"
    />


    <!-- ===================================================
         COLOR CHANGE
    ==================================================== */

    <animate
      attributeName="fill"
      values="${colorValues}"
      keyTimes="${keyTimes}"
      dur="${duration}s"
      repeatCount="indefinite"
    />

  </g>


  <!-- =====================================================
       DRAGON MOVEMENT
  ====================================================== -->

  <animateTransform
    attributeName="transform"
    type="translate"

    values="
      ${translateValues}
    "

    keyTimes="
      ${keyTimes}
    "

    dur="${duration}s"

    repeatCount="indefinite"

    calcMode="linear"
  />

</g>
`;


/* =========================================================
   IMPORTANT:
   Apply color animation to every dragon component
========================================================= */

const colorAnimation = `
  <animate
    attributeName="fill"
    values="${colorValues}"
    keyTimes="${keyTimes}"
    dur="${duration}s"
    repeatCount="indefinite"
  />
`;


/*
   Add color animations separately to the
   major dragon parts so the whole dragon
   changes color.
*/

const finalDragon = dragon.replace(
  '</g>\n\n\n  <!-- =====================================================\n       DRAGON MOVEMENT',
  `${colorAnimation}
  </g>


  <!-- =====================================================
       DRAGON MOVEMENT`
);


/* =========================================================
   ADD DISAPPEAR ANIMATION TO CONTRIBUTIONS
========================================================= */

let finalCells = '';

for (
  let i = 0;
  i < cells.length;
  i++
) {
  finalCells += cells[i] + '\n';
}


/*
   Instead of trying to guess the cell indexes
   from the complete cells array, create the
   animated contribution cells again.
*/

const animatedCells = [];

let contributionIndex = 0;

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

    if (count === 0) {

      animatedCells.push(`
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

    const contributionColor =
      getContributionColor(count);

    const normalizedTime =
      (contributionIndex + 1) /
      (totalPoints - 1);

    const beginTime =
      duration * normalizedTime;

    animatedCells.push(`
      <g>

        <rect
          x="${px}"
          y="${py}"
          width="${cell}"
          height="${cell}"
          rx="2.5"
          fill="${contributionColor}"
        />

        <animate
          attributeName="opacity"
          values="1;1;0"
          keyTimes="0;0.30;1"
          dur="0.16s"
          begin="${beginTime.toFixed(3)}s"
          repeatCount="indefinite"
          fill="freeze"
        />

      </g>
    `);

    contributionIndex++;
  }
}


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

  <!-- CONTRIBUTION GRAPH -->

  ${animatedCells.join('\n')}


  <!-- DRAGON -->

  ${finalDragon}

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
  `🐉 Dragon generated successfully — ${contributionPoints.length} contributions`
);
