// Based on RC4 algorithm, as described in
// http://en.wikipedia.org/wiki/RC4

// :: string | array integer -> array integer
function seed(key: string | number[] | undefined, N: number): number[] {
  if (key === undefined) {
    key = Array(N).fill(0).map(() => Math.floor(Math.random() * N));
  } else if (typeof key === "string") {
    key = key.split("").map(c => c.charCodeAt(0) % N);
  } else if (Array.isArray(key)) {
    if (!key.every(v => typeof v === "number" && v === (v | 0))) {
      throw new TypeError("invalid seed key specified: not array of integers");
    }
  } else {
    throw new TypeError("invalid seed key specified");
  }

  // reseed state
  const s = Array(N).fill(0).map((_, i) => i);

  let j = 0;
  for (let i = 0; i < N; i++) {
    j = (j + s[i] + key[i % key.length]) % N;
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

export interface RC4State {
  i: number;
  j: number;
  s: number[];
}

export default class RC4 {
  public static RC4small: typeof RC4small;

  private i: number;
  private j: number;
  private s: number[];

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
    if (a === undefined || (arguments.length > 2)) {
      throw new TypeError("random takes one or two integer arguments");
    }

    a = typeof a === "string" ? parseInt(a, 10) : a;
    b = typeof b === "string" ? parseInt(b, 10) : b;

    const [min, max] = b === undefined ? [0, a] : [a, b];

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new TypeError("random takes one or two integer arguments");
    }

    return min + this.randomUInt32() % (max - min + 1);
  }

  randomByte(): number {
    return this.randomNative();
  }

  currentState(): RC4State {
    return {
      i: this.i,
      j: this.j,
      s: [...this.s],
    };
  }

  setState(state: RC4State) {
    const { s, i, j } = state;

    if (!(i === (i | 0) && i >= 0 && i < this.s.length)) {
      throw new Error("state.i should be integer [0, " + (this.s.length - 1) + "]");
    }

    if (!(j === (j | 0) && j >= 0 && j < this.s.length)) {
      throw new Error("state.j should be integer [0, " + (this.s.length - 1) + "]");
    }

    // check length
    if (!Array.isArray(s) || s.length !== this.s.length) {
      throw new Error("state should be array of length " + this.s.length);
    }

    // check that all params are there
    const seen: Array<number | undefined> = Array(s.length);
    for (let k = 0; k < s.length; k++) {
      if (s[k] < 0 || s[k] >= s.length) {
        throw new Error("state should be permutation of 0.." + (s.length - 1) + ": " + s[k] + " is out of range");
      }
      if (seen[s[k]] !== undefined) {
        throw new Error("state should be permutation of 0.." + (s.length - 1) + ": " + s[k] + " is duplicated");
      }
      seen[s[k]] = k;
    }

    this.i = i;
    this.j = j;
    this.s = [...s]; // assign copy
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

    this.setState({ i, j, s });
  }
}

RC4.RC4small = RC4small;
