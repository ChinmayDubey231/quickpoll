/**
 * registerPollHandlers — called for every new socket connection.
 * Keeps all socket logic in one place; io and socket are injected from index.js.
 */
export const registerPollHandlers = (io, socket) => {
  // ── join-poll ──────────────────────────────────────────────────────────────
  // Client emits this on PollView mount. Puts the socket into a room named by
  // pollId so vote-update and poll-closed are scoped to that poll only.
  socket.on('join-poll', ({ pollId }) => {
    if (!pollId || typeof pollId !== 'string') return;

    // Leave any previously joined poll rooms to keep things tidy
    // (a single browser tab only ever watches one poll at a time)
    socket.rooms.forEach((room) => {
      if (room !== socket.id) socket.leave(room);
    });

    socket.join(pollId);

    // Useful for debugging — visible in server logs during dev
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 socket ${socket.id} joined poll room ${pollId}`);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  // Socket.io cleans up rooms automatically on disconnect, but we log it.
  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 socket ${socket.id} disconnected: ${reason}`);
    }
  });
};
