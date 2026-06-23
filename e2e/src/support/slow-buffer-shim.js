'use strict';

const bufferModule = require('buffer');

if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

if (!bufferModule.SlowBuffer.prototype.equal) {
  bufferModule.SlowBuffer.prototype.equal = function equal(other) {
    if (!bufferModule.Buffer.isBuffer(other) || this.length !== other.length) {
      return false;
    }

    return bufferModule.Buffer.compare(this, other) === 0;
  };
}
