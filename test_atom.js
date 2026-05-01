const fs = require('fs');

async function test() {
  const res = await fetch(`https://github.com/nxtcoreee3/Flux/commits/main.atom?t=${Date.now()}`);
  const xmlText = await res.text();
  const idMatch = xmlText.match(/<id>tag:github.com,2008:Grit::Commit\/([0-9a-f]{7,40})<\/id>/i);
  console.log("ID match:", idMatch ? idMatch[1] : null);
}
test();
