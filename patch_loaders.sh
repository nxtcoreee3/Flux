#!/bin/bash
LOADER="  <div id=\"global-page-loader\" style=\"position:fixed;inset:0;background:#ffffff;z-index:9999999;display:flex;justify-content:center;align-items:center;transition:opacity 0.4s ease;\">\n    <img src=\"assets/loading.gif\" style=\"width:250px;height:auto;\" alt=\"Loading...\">\n  </div>\n"
for file in *.html; do
  # use perl to insert the loader exactly after <body>
  perl -i -pe "s/<body>/<body>\n$LOADER/" "$file"
done
