import fs from "fs";

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  throw new Error("Missing GITHUB_USERNAME or GITHUB_TOKEN");
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
}
`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "dragon-contribution-graph"
  },
  body: JSON.stringify({
    query,
    variables: { login: username }
  })
});

if (!res.ok) {
  throw new Error(`GitHub API error: ${res.status}`);
}

const data = await res.json();

if (data.errors) {
  throw new Error(
    data.errors.map(e => e.message).join("; ")
  );
}

const weeks =
  data.data?.user?.contributionsCollection
    ?.contributionCalendar?.weeks;

if (!weeks?.length) {
  throw new Error("No contribution data found");
}


/* =========================================================
   GRAPH SETTINGS
========================================================= */

const rows = 7;
const cols = weeks.length;

const cell = 11;
const gap = 3;
const step = cell + gap;

const left = 42;
const top = 30;
const right = 42;
const bottom = 30;

const width = left + cols * step + right;
const height = top + rows * step + bottom;


/* =========================================================
   CONTRIBUTION COLORS
========================================================= */

function getColor(count) {
  if (count >= 15) return "#39d353";
  if (count >= 8) return "#26a641";
  if (count >= 3) return "#006d32";
  return "#0e4429";
}


/* =========================================================
   COLLECT NON-ZERO CONTRIBUTIONS
========================================================= */

const contributions = [];

for (let x = 0; x < cols; x++) {
  const days = weeks[x]?.contributionDays || [];

  for (let y = 0; y < rows; y++) {
    const count = days[y]?.contributionCount || 0;

    if (count <= 0) continue;

    const px = left + x * step;
    const py = top + y * step;

    contributions.push({
      x: px + cell / 2,
      y: py + cell / 2,
      count,
      color: getColor(count)
    });
  }
}


/* =========================================================
   ANIMATION DURATION
========================================================= */

const animationDuration = Math.max(
  16,
  Math.min(
    30,
    contributions.length * 0.12
  )
);


/* =========================================================
   CALCULATE DISTANCES
========================================================= */

let totalDistance = 0;

const distances = [0];

for (let i = 1; i < contributions.length; i++) {
  const a = contributions[i - 1];
  const b = contributions[i];

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const distance = Math.sqrt(
    dx * dx + dy * dy
  );

  totalDistance += distance;
  distances.push(totalDistance);
}


/* =========================================================
   NORMALIZED ARRIVAL TIMES

   IMPORTANT:
   These times are synchronized with the dragon path.
   The cell stays visible until the dragon reaches it.
========================================================= */

const times = contributions.map((_, i) => {

  if (totalDistance === 0) {
    return 0;
  }

  return distances[i] / totalDistance;

});


/* =========================================================
   GRAPH CELLS
========================================================= */

const cells = [];

let index = 0;

for (let x = 0; x < cols; x++) {

  const days = weeks[x]?.contributionDays || [];

  for (let y = 0; y < rows; y++) {

    const count =
      days[y]?.contributionCount || 0;

    const px = left + x * step;
    const py = top + y * step;

    if (count === 0) {

      cells.push(
        `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2.5" fill="#161b22" stroke="#30363d" stroke-width=".4"/>`
      );

      continue;
    }

    const t = times[index];

    /*
      Keep the cell visible until the dragon reaches it.

      A tiny delay after arrival makes sure the dragon
      visibly visits the cell before it disappears.
    */

    const hideStart = Math.min(
      0.99999,
      t + 0.012
    );

    const fadeStart = Math.max(
      0,
      hideStart - 0.006
    );

    const color = getColor(count);

    cells.push(`
<rect
id="c${index}"
x="${px}"
y="${py}"
width="${cell}"
height="${cell}"
rx="2.5"
fill="${color}">
<animate
attributeName="opacity"
values="1;1;1;0;0;1"
keyTimes="0;${t.toFixed(5)};${fadeStart.toFixed(5)};${hideStart.toFixed(5)};0.99999;1"
dur="${animationDuration}s"
repeatCount="indefinite"/>
</rect>`);

    index++;
  }
}


/* =========================================================
   DRAGON FLIGHT POINTS
========================================================= */

const flightPoints = [];

if (contributions.length > 0) {

  /*
    Start slightly outside the graph.
  */

  flightPoints.push({
    x: left - 38,
    y: contributions[0].y
  });


  for (let i = 0; i < contributions.length; i++) {

    const p = contributions[i];

    /*
      Very small wave.
      Dragon itself never rotates.
    */

    const wave =
      Math.sin(i * 0.7) * 2.5;

    flightPoints.push({
      x: p.x,
      y: p.y + wave
    });
  }


  /*
    Finish outside the graph.
  */

  const last =
    contributions[contributions.length - 1];

  flightPoints.push({
    x: left + cols * step + 38,
    y: last.y
  });

} else {

  flightPoints.push(
    {
      x: left - 38,
      y: top + 30
    },
    {
      x: left + cols * step + 38,
      y: top + 30
    }
  );
}


/* =========================================================
   FLIGHT VALUES
========================================================= */

const flightValues = flightPoints
  .map(p => `${p.x},${p.y}`)
  .join(";");

const flightKeyTimes = flightPoints
  .map((_, i) => {

    if (flightPoints.length <= 1) {
      return "0";
    }

    return (
      i /
      (flightPoints.length - 1)
    ).toFixed(5);

  })
  .join(";");


/* =========================================================
   DRAGON COLORS
========================================================= */

const dragonColors = [];

if (contributions.length > 0) {

  /*
    First color.
  */

  dragonColors.push(
    contributions[0].color
  );

  for (const c of contributions) {
    dragonColors.push(c.color);
  }

  /*
    Final color.
  */

  dragonColors.push(
    contributions[
      contributions.length - 1
    ].color
  );

} else {

  dragonColors.push("#39d353");
  dragonColors.push("#39d353");
}


const dragonColorValues =
  dragonColors.join(";");

const dragonColorKeyTimes = dragonColors
  .map((_, i) => {

    if (dragonColors.length <= 1) {
      return "0";
    }

    return (
      i /
      (dragonColors.length - 1)
    ).toFixed(5);

  })
  .join(";");


/* =========================================================
   DRAGON
========================================================= */

const dragon = `
<g id="dragon">

  <g
    id="dragon-art"
    transform="scale(.85)"
    color="#39d353"
  >

    <!-- tail -->

    <path
      d="M-7 0 C-15 1 -23 4 -31 1 C-38 -1 -43 -4 -49 0"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />

    <path
      d="M-44 0 L-52 -5 L-49 0 L-52 5 L-44 3 Z"
      fill="currentColor"
    />

    <!-- body -->

    <ellipse
      cx="0"
      cy="0"
      rx="9"
      ry="5"
      fill="currentColor"
      stroke="#0e4429"
      stroke-width=".8"
    />

    <!-- spikes -->

    <path
      d="M-6 -3 L-9 -8 L-2 -4 L2 -9 L5 -4 L10 -7 L10 -2 Z"
      fill="currentColor"
    />

    <!-- upper wing -->

    <g>

      <path
        d="M-1 -2 C-6 -11 -15 -17 -24 -13 C-20 -8 -13 -3 -5 2 Z"
        fill="currentColor"
        stroke="#0e4429"
        stroke-width=".8"
      />

      <animateTransform
        attributeName="transform"
        type="rotate"
        values="0 -2 0;-12 -2 0;0 -2 0;10 -2 0;0 -2 0"
        dur=".75s"
        repeatCount="indefinite"
      />

    </g>


    <!-- lower wing -->

    <g>

      <path
        d="M-2 2 C-7 10 -16 15 -24 11 C-18 7 -12 3 -5 -2 Z"
        fill="currentColor"
        stroke="#0e4429"
        stroke-width=".8"
      />

      <animateTransform
        attributeName="transform"
        type="rotate"
        values="0 -2 2;10 -2 2;0 -2 2;-9 -2 2;0 -2 2"
        dur=".75s"
        repeatCount="indefinite"
      />

    </g>


    <!-- neck -->

    <path
      d="M6 -1 C9 -3 12 -3 15 -1 L15 2 C12 3 9 2 6 1 Z"
      fill="currentColor"
    />


    <!-- head -->

    <path
      d="M9 0 C13 -4 19 -4 23 0 C19 4 13 4 9 0 Z"
      fill="currentColor"
      stroke="#0e4429"
      stroke-width=".8"
    />


    <!-- snout -->

    <path
      d="M19 -2 L29 0 L19 2 Z"
      fill="currentColor"
    />


    <!-- horns -->

    <path
      d="M12 -3 L13 -9 L17 -3 Z"
      fill="#26a641"
    />

    <path
      d="M9 -2 L6 -7 L13 -3 Z"
      fill="#26a641"
    />


    <!-- eye -->

    <circle
      cx="20"
      cy="-1.2"
      r="1.2"
      fill="#f2cc60"
    />

    <circle
      cx="20.3"
      cy="-1.2"
      r=".4"
      fill="#0d1117"
    />


    <!-- legs -->

    <path
      d="M5 3 L9 8 L12 8"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />

    <path
      d="M-4 3 L-7 8 L-10 8"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />


    <!-- color follows contribution -->

    <animate
      attributeName="color"
      values="${dragonColorValues}"
      keyTimes="${dragonColorKeyTimes}"
      dur="${animationDuration}s"
      repeatCount="indefinite"
    />

  </g>


  <!-- rigid whole-dragon movement -->

  <animateMotion
    dur="${animationDuration}s"
    repeatCount="indefinite"
    calcMode="paced"
    rotate="0"
  >

    <mpath href="#flightPath"/>

  </animateMotion>

</g>
`;


/* =========================================================
   FLIGHT PATH
========================================================= */

const pathData =
  flightPoints.length > 0
    ? `M ${flightPoints[0].x} ${flightPoints[0].y} ` +
      flightPoints
        .slice(1)
        .map(p => `L ${p.x} ${p.y}`)
        .join(" ")
    : `M 0 0 L ${width} 0`;


/* =========================================================
   FINAL SVG
========================================================= */

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg
xmlns="http://www.w3.org/2000/svg"
xmlns:xlink="http://www.w3.org/1999/xlink"
width="${width}"
height="${height}"
viewBox="0 0 ${width} ${height}"
role="img"
aria-label="Dragon Contribution Graph">

<defs>

  <path
    id="flightPath"
    d="${pathData}"
    fill="none"
    stroke="none"
  />

</defs>


<rect
width="100%"
height="100%"
rx="8"
fill="#0d1117"
/>


${cells.join("")}


${dragon}


</svg>
`;


/* =========================================================
   WRITE FILE
========================================================= */

fs.mkdirSync("dragon", {
  recursive: true
});

fs.writeFileSync(
  "dragon/dragon.svg",
  svg,
  "utf8"
);


console.log(
  `🐉 Dragon generated successfully: ${contributions.length} contributions`
);

console.log(
  `📦 SVG size: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`
);

console.log(
  `⏱️ Animation: ${animationDuration.toFixed(1)} seconds`
);
