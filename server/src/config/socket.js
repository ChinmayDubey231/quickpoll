/**
 * Thin wrapper so controllers and workers can import `getIO()`
 * without creating a circular dependency on index.js.
 *
 * index.js calls setIO(io) once after creating the Server instance.
 * Everyone else calls getIO().
 */
let _io = null;

export const setIO = (io) => { _io = io; };

export const getIO = () => {
  if (!_io) throw new Error('Socket.io not initialised — call setIO(io) first');
  return _io;
};
