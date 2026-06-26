import bufferModule = require('buffer');

const mutableBufferModule = bufferModule as typeof bufferModule & {
  SlowBuffer?: typeof Buffer;
};

if (!mutableBufferModule.SlowBuffer) {
  mutableBufferModule.SlowBuffer = mutableBufferModule.Buffer;
}

if (!mutableBufferModule.SlowBuffer.prototype.equal) {
  mutableBufferModule.SlowBuffer.prototype.equal = function equal(
    other: Buffer
  ): boolean {
    if (
      !mutableBufferModule.Buffer.isBuffer(other) ||
      this.length !== other.length
    ) {
      return false;
    }

    return mutableBufferModule.Buffer.compare(this, other) === 0;
  };
}
