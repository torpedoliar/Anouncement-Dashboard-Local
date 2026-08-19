import fs from "node:fs";
const s = fs.readFileSync("_c02_build.json", "utf8");
for (const frag of ["Turing", "weird", "0bers", "2026-08-12-ui".slice(0, 9) + "x"]) {
  let c = 0, i = -1;
  while ((i = s.indexOf(frag, i + 1)) !== -1) c++;
  console.log(JSON.stringify(frag), c);
}
const re = /"source_file":"([^"]*)"/g;
const seen = new Set();
let m;
while ((m = re.exec(s))) if (!seen.has(m[1])) { seen.add(m[1]); console.log("SF:", m[1]); }
