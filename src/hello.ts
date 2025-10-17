/**
 * Simple smoke-test function kept from the project scaffold.  It reassures us
 * that TypeScript is wired correctly.  Feel free to remove or ignore it when
 * building the real interface.
 */
export function hello() {
  return "TypeScript is set up!";
}

if (require.main === module) {
  // When run directly from the command line, print the confirmation message.
  console.log(hello());
}