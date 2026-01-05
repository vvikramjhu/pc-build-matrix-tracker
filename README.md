Easiest: just open index.html in your browser (double-click it).
Better: run a tiny local server:
bash
Copy
# Option 1 - Python
python -m http.server 8000
# then open http://localhost:8000 in your browser

# Option 2 - Node (if installed)
npx serve .
The Matrix UI will load and app.js will fetch the CSV file and render your data.

# Can also go to github pages (https://github.com/vvikramjhu/pc-build-matrix-tracker/deployments/github-pages ) and use this link to see the items instead of running locally
https://vvikramjhu.github.io/pc-build-matrix-tracker/ 