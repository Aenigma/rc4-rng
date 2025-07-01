"use strict";

// Based on RC4 algorithm, as described in
// http://en.wikipedia.org/wiki/RC4


function isInteger(n: string | number): boolean {
  return parseInt(n as string, 10) === n;
}

// :: string | array integer -> array integer
function seed(key: string | number[] | undefined, N: number): number[] {

  function identityPermutation() {
    const s: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      s[i] = i;
    }
    return s;
  }

  if (key === undefined) {
    key = new Array(N);
    for (let k = 0; k < N; k++) {
      key[k] = Math.floor(Math.random() * N);
    }
  } else if (typeof key === "string") {
    // to string
    key = "" + key;
    key = key.split("").map(c => c.charCodeAt(0) % N);
  } else if (Array.isArray(key)) {
    if (!key.every(v => typeof v === "number" && v === (v | 0))) {
      throw new TypeError("invalid seed key specified: not array of integers");
    }
  } else {
    throw new TypeError("invalid seed key specified");
  }

  const keylen = key.length;

  // reseed state
  const s = identityPermutation();

  let j = 0;
  for (let i = 0; i < N; i++) {
    j = (j + s[i] + key[i % keylen]) % N;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }

  return s;
}

const ordA = "a".charCodeAt(0);
const ord0 = "0".charCodeAt(0);

function toHex(n: number) {
  return n < 10 ? String.fromCharCode(ord0 + n) : String.fromCharCode(ordA + n - 10);
}

function fromHex(c: string) {
  return parseInt(c, 16);
}

interface RC4State {
  i: number;
  j: number;
  s: number[];
}

export default class RC4 {
  public static RC4small: typeof RC4small;

  protected i: number;
  protected j: number;
  protected s: number[];

  constructor(key: string | number[], keyLength = 256) {
    this.i = 0;
    this.j = 0;
    this.s = seed(key, keyLength);
  }

  randomNative() {
    this.i = (this.i + 1) % this.s.length;
    this.j = (this.j + this.s[this.i]) % this.s.length;

    const tmp = this.s[this.i];
    this.s[this.i] = this.s[this.j];
    this.s[this.j] = tmp;

    const k = this.s[(this.s[this.i] + this.s[this.j]) % this.s.length];

    return k;
  }

  randomUInt32() {
    const a = this.randomByte();
    const b = this.randomByte();
    const c = this.randomByte();
    const d = this.randomByte();

    return ((a * 256 + b) * 256 + c) * 256 + d;
  }

  randomFloat() {
    return this.randomUInt32() / 0x100000000;
  }

  random(max: number | string): number;
  random(min: number | string, max: number | string): number;
  random(a: number | string, b?: number | string | undefined): number {
    if (arguments.length === 1) {
      a = 0;
      b = arguments[0];
    } else if (arguments.length === 2) {
      a = arguments[0];
      b = arguments[1];
    } else {
      throw new TypeError("random takes one or two integer arguments");
    }

    a = typeof a === "string" ? parseInt(a, 10) : a;
    b = typeof b === "string" ? parseInt(b, 10) : b;

    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new TypeError("random takes one or two integer arguments");
    }

    return a + this.randomUInt32() % (b - a + 1);
  }

  randomByte(): number {
    return this.randomNative();
  }

  currentState(): RC4State {
    return {
      i: this.i,
      j: this.j,
      s: this.s.slice(),
    };
  }

  setState(state: RC4State) {
    const s = state.s;
    const i = state.i;
    const j = state.j;

    if (!(i === (i | 0) && 0 <= i && i < this.s.length)) {
      throw new Error("state.i should be integer [0, " + (this.s.length - 1) + "]");
    }

    if (!(j === (j | 0) && 0 <= j && j < this.s.length)) {
      throw new Error("state.j should be integer [0, " + (this.s.length - 1) + "]");
    }

    // check length
    if (!Array.isArray(s) || s.length !== this.s.length) {
      throw new Error("state should be array of length " + this.s.length);
    }

    // check that all params are there
    for (var k = 0; k < this.s.length; k++) {
      if (s.indexOf(k) === -1) {
        throw new Error("state should be permutation of 0.." + (this.s.length - 1) + ": " + k + " is missing");
      }
    }

    this.i = i;
    this.j = j;
    this.s = s; // assign copy
  }
}

export class RC4small extends RC4 {
  constructor(key: string | number[]) {
    super(key, 16);
  }

  randomByte(): number {
    const a = this.randomNative();
    const b = this.randomNative();

    return a * 16 + b;
  }

  currentStateString(): string {
    const state = this.currentState();

    const i = toHex(state.i);
    const j = toHex(state.j);

    const res = i + j + state.s.map(toHex).join("");
    return res;
  }

  setStateString(stateString: string) {
    if (!stateString.match(/^[0-9a-f]{18}$/)) {
      throw new TypeError("RC4small stateString should be 18 hex character string");
    }

    const i = fromHex(stateString[0]);
    const j = fromHex(stateString[1]);
    const s = stateString.split("").slice(2).map(fromHex);

    this.setState({
      i,
      j,
      s,
    });
  }
}

RC4.RC4small = RC4small;
if (typeof module !== "undefined" && module.exports) {
  module.exports = RC4;
  module.exports.RC4small = RC4small;
  module.exports.default = RC4;
}
