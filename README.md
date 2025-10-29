# Train Schedule Query (Koa + TypeScript)

A high-performance Koa server that returns direct and 1-transfer train schedules between two stations. Data is loaded once at startup from the provided JSON files and kept in memory.

## Features

- Koa + TypeScript, fast in-memory lookups
- Reads `SingleCityTrack.json` and all `{cityTrackId}.json` files once at startup
- Supports direct trains and single-transfer solutions
- Sorts by total travel time (shortest first)
- Mobile-friendly UI with Tailwind CSS (via CDN)

## Prerequisites

- Node.js 18+
- yarn

## Setup

```shell
# From the project root (the folder containing package.json)
# 1) Install dependencies
yarn install

# 2) Build TypeScript
yarn run build

# 3) Start the server
yarn start
```

The server will start at:

```
http://localhost:3000
```

## Usage

- Endpoint: `GET /train-schedule?start=起点站&end=终点站`
- Example: `http://localhost:3000/train-schedule?start=惠州北&end=肇庆`

If any validation fails:
- Same station for start/end: `Start and end stations cannot be the same.`
- Station not found: `One or both stations not found in the system.`

## Data

- Data files expected under `data/` at project root:
  - `data/SingleCityTrack.json`
  - `data/239.json`, `data/240.json`, `data/241.json`, `data/242.json`, `data/243.json`, `data/244.json`

## Development

For live-reload development:

```shell
# Start in dev mode (ts-node-dev)
 yarn run dev
```

## Notes

- Time calculations assume same-day service; if an arrival/departure crosses midnight, the next-day wrap is handled simply by adding 24h when needed.
- One transfer is supported. If no matching timing is found, you may see only direct results or none.
- Tailwind CSS is included via CDN and does not require a build step.

## test cases
1. 小金口 to 科韵路 departing at 12:40
2. 樟木头东 to 科韵路 departing at 07:30
3. 科韵路 to 清城 departing at 07:30
4. 小金口 to 白云机场南 departing at 07:00
5. 小金口 to 白云机场北 departing at 12:30 // 先反方向中转，再上快车