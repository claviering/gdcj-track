#!/usr/bin/env node

/*
  remove-keys-from-json.js

  A CLI to remove specified keys recursively from a JSON file.

  Usage:
    node remove-keys-from-json.js -i input.json [-o output.json]
    node remove-keys-from-json.js -i input.json --in-place
    node remove-keys-from-json.js -i input.json --keys createTime creator modifyTime modifier isStartStation -o output.json

  Notes:
    - If -o/--output is omitted and --in-place is not set, will write to <input>.cleaned.json
    - The default keys to remove are: createTime, creator, modifyTime, modifier, isStartStation
*/

const fs = require('fs');
const path = require('path');

function printHelp() {
  const help = `\nRemove specified keys recursively from a JSON file.\n\nUsage:\n  node remove-keys-from-json.js -i <input.json> [options]\n\nOptions:\n  -i, --input <path>       Input JSON file path (required)\n  -o, --output <path>      Output JSON file path (default: <input>.cleaned.json)\n      --in-place           Overwrite the input file in place\n      --keys <k1 k2 ...>   Space-separated list of keys to remove (default: createTime creator modifyTime modifier isStartStation)\n  -s, --space <n>          Indentation spaces for output JSON (default: 2)\n  -h, --help               Show this help message\n`;
  console.log(help);
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    inPlace: false,
    keys: ['createTime', 'creator', 'modifyTime', 'modifier', 'isStartStation'],
    space: 2,
  };

  const arr = argv.slice(2);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    switch (a) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-i':
      case '--input':
        i++;
        args.input = arr[i];
        break;
      case '-o':
      case '--output':
        i++;
        args.output = arr[i];
        break;
      case '--in-place':
        args.inPlace = true;
        break;
      case '--keys': {
        const keys = [];
        // Collect remaining tokens until next flag (starts with '-') or end
        while (i + 1 < arr.length && !arr[i + 1].startsWith('-')) {
          i++;
          keys.push(arr[i]);
        }
        if (keys.length) args.keys = keys;
        break;
      }
      case '-s':
      case '--space':
        i++;
        args.space = Number(arr[i]);
        if (!Number.isFinite(args.space) || args.space < 0) {
          throw new Error('Invalid space value. Must be a non-negative number.');
        }
        break;
      default:
        if (a.startsWith('-')) {
          throw new Error(`Unknown option: ${a}`);
        } else {
          // Positional fallback: if input not set, treat as input
          if (!args.input) args.input = a;
          else if (!args.output) args.output = a;
          else {
            throw new Error(`Unexpected positional argument: ${a}`);
          }
        }
    }
  }
  return args;
}

function isPlainObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

function stripKeysDeep(value, keysSet, stats) {
  if (Array.isArray(value)) {
    return value.map((v) => stripKeysDeep(v, keysSet, stats));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (keysSet.has(k)) {
        stats.removed++; // count removed occurrence
        continue; // skip this key
      }
      out[k] = stripKeysDeep(v, keysSet, stats);
    }
    return out;
  }
  return value; // primitives and null unchanged
}

function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.help || !args.input) {
      printHelp();
      process.exit(args.help ? 0 : 1);
    }

    const inputPath = path.resolve(process.cwd(), args.input);
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    if (args.inPlace) {
      args.output = inputPath;
    } else if (!args.output) {
      const { dir, name, ext } = path.parse(inputPath);
      const outName = `${name}${ext.toLowerCase() === '.json' ? '' : ext}.cleaned.json`;
      args.output = path.join(dir, outName);
    } else {
      args.output = path.resolve(process.cwd(), args.output);
    }

    const raw = fs.readFileSync(inputPath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to parse JSON from ${inputPath}:`, e.message);
      process.exit(1);
    }

    const keysSet = new Set(args.keys);
    const stats = { removed: 0 };
    const cleaned = stripKeysDeep(data, keysSet, stats);

    const outStr = JSON.stringify(cleaned, null, args.space);
    fs.writeFileSync(args.output, outStr + '\n', 'utf8');

    const outRel = path.relative(process.cwd(), args.output) || args.output;
    console.log(`Done. Removed ${stats.removed} occurrences of [${[...keysSet].join(', ')}].`);
    console.log(`Written to: ${outRel}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { stripKeysDeep };
