'use strict';

const PREFIX = '[[TITLE]]';
const END = '[[/TITLE]]';

/** Strip the optional title emitted at the start of the same streamed answer. */
function createTitleStream(enabled, emit) {
  let pending = enabled === true;
  let buffer = '';
  let title;
  function push(chunk) {
    if (!pending) { emit(chunk); return; }
    buffer += chunk;
    const start = buffer.trimStart();
    if (PREFIX.startsWith(start)) return;
    if (!start.startsWith(PREFIX)) { pending = false; emit(buffer); buffer = ''; return; }
    const end = start.indexOf(END, PREFIX.length);
    if (end >= 0) {
      const name = start.slice(PREFIX.length, end).replace(/\s+/g, ' ').trim().slice(0, 55);
      if (name) title = name;
      const answer = start.slice(end + END.length).replace(/^\s+/, '');
      pending = false; buffer = '';
      if (answer) emit(answer);
    } else if (buffer.length > 200) { pending = false; emit(buffer); buffer = ''; }
  }
  function finish() {
    if (pending && buffer && !buffer.trimStart().startsWith(PREFIX)) emit(buffer);
    pending = false; buffer = '';
    return title;
  }
  return { push, finish };
}

module.exports = { createTitleStream };
