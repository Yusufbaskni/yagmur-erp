// The Next.js server and Prisma live in extraResources, not in the Electron asar.
module.exports = async function skipNodeModules() {
  return false;
};
