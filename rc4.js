"use strict";

// Based on RC4 algorithm, as described in
// http://en.wikipedia.org/wiki/RC4

/**
 * @param {number} n
 * @returns {boolean}
 */
function isInteger(n) {
  return parseInt(n, 10) === n;
}

// :: string | array integer -> array integer
/**
 * @param {string | number[]} key
 * @param {number} N
 * @returns {number[]}
 */
function seed(key, N) {
  /**
   * @returns {number[]}
   */
  function identityPermutation() {
    const s = new Array(N);
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
    key = key.split("").map(function (c) { return c.charCodeAt(0) % N; });
  } else if (Array.isArray(key)) {
    if (!key.every(function (v) {
      return typeof v === "number" && v === (v | 0);
    })) {
      throw new TypeError("invalid seed key specified: not array of integers");
    }
  } else {
    throw new TypeError("invalid seed key specified");
  }

  const keylen = key.length;

  // resed state
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

/**
 * @param {number} n
 * @returns {string}
 */
function toHex(n) {
  return n < 10 ? String.fromCharCode(ord0 + n) : String.fromCharCode(ordA + n - 10);
}

/**
 * @param {string} c
 * @returns {number}
 */
function fromHex(c) {
  return parseInt(c, 16);
}
class RC4 {

  /**
 * @param {string | number[]} key
 */
  constructor(key, keyLength = 256) {
    /** @type {number} */
    this.keyLength = keyLength;
    /** @type {number} */
    this.i = 0;
    /** @type {number} */
    this.j = 0;
    /** @type {number[]} */
    this.s = seed(key, keyLength);
  }

  /**
   * @returns {number}
   */
  randomNative() {
    this.i = (this.i + 1) % this.keyLength;
    this.j = (this.j + this.s[this.i]) % this.keyLength;

    const tmp = this.s[this.i];
    this.s[this.i] = this.s[this.j];
    this.s[this.j] = tmp;

    const k = this.s[(this.s[this.i] + this.s[this.j]) % this.keyLength];

    return k;
  }

  randomUInt32() {
    const a = this.randomByte();
    const b = this.randomByte();
    const c = this.randomByte();
    const d = this.randomByte();

    return ((a * 256 + b) * 256 + c) * 256 + d;
  }

  /**
   * @returns {number}
   */
  randomFloat() {
    return this.randomUInt32() / 0x100000000;
  }

  /**
   * @param {number | string} a
   * @param {number | string | undefined} b
   * @returns {number}
   */
  random(a, b) {
    if (arguments.length === 1) {
      a = 0;
      b = arguments[0];
    } else if (arguments.length === 2) {
      a = arguments[0];
      b = arguments[1];
    } else {
      throw new TypeError("random takes one or two integer arguments");
    }

    if (!isInteger(a) || !isInteger(b)) {
      throw new TypeError("random takes one or two integer arguments");
    }

    return a + this.randomUInt32() % (b - a + 1);
  }

  /**
   * @returns {number}
   */
  randomByte() {
    return this.randomNative();
  }

  currentState() {
    return {
      i: this.i,
      j: this.j,
      s: this.s.slice(),
    };
  }

  /**
   * @param {RC4} state
   */
  setState(state) {
    const s = state.s;
    const i = state.i;
    const j = state.j;

    /* eslint-disable yoda */
    if (!(i === (i | 0) && 0 <= i && i < this.keyLength)) {
      throw new Error("state.i should be integer [0, " + (this.keyLength - 1) + "]");
    }

    if (!(j === (j | 0) && 0 <= j && j < this.keyLength)) {
      throw new Error("state.j should be integer [0, " + (this.keyLength - 1) + "]");
    }
    /* eslint-enable yoda */

    // check length
    if (!Array.isArray(s) || s.length !== this.keyLength) {
      throw new Error("state should be array of length " + this.keyLength);
    }

    // check that all params are there
    for (var k = 0; k < this.keyLength; k++) {
      if (s.indexOf(k) === -1) {
        throw new Error("state should be permutation of 0.." + (this.keyLength - 1) + ": " + k + " is missing");
      }
    }

    this.i = i;
    this.j = j;
    this.s = s; // assign copy
  }
}
class RC4small extends RC4 {
  constructor(key) {
    super(key, 16);
  }

  /**
   * @returns {number}
   */
  randomByte() {
    const a = this.randomNative();
    const b = this.randomNative();

    return a * 16 + b;
  }

  /**
   * @returns {string}
   */
  currentStateString() {
    const state = this.currentState();

    const i = toHex(state.i);
    const j = toHex(state.j);

    const res = i + j + state.s.map(toHex).join("");
    return res;
  }

  /**
   * @param {string} stateString
   */
  setStateString(stateString) {
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

module.exports = RC4;
