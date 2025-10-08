export function hello() {
  return "TypeScript is set up!";
}

if (require.main === module) {
  console.log(hello());
}