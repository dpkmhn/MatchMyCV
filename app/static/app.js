// MatchMyCV front end. All model output is inserted with textContent, never innerHTML.

const $ = (sel) => document.querySelector(sel);
const form = $("#form"), go = $("#go"), steps = $("#steps"), errorBox = $("#error");
const fileInput = $("#resume_file"), drop = $("#drop"), dropLabel = $("#drop-label");
const results = $("#results");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ---------------------------------------------------------------- file input / drag & drop
function showFile() {
  const f = fileInput.files[0];
  drop.classList.toggle("has-file", !!f);
  dropLabel.textContent = f ? `📄 ${f.name} (${Math.round(f.size / 1024)} KB) — click to change` :
    "Drop a PDF / DOCX / TXT here, or click to choose";
}
fileInput.addEventListener("change", showFile);
["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => {
  ev.preventDefault(); drop.classList.add("over");
}));
["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => {
  ev.preventDefault(); drop.classList.remove("over");
}));
drop.addEventListener("drop", (ev) => {
  if (ev.dataTransfer.files.length) { fileInput.files = ev.dataTransfer.files; showFile(); }
});

$("#sample").addEventListener("click", async () => {
  const [r, j] = await Promise.all([
    fetch("/static/samples/resume.txt").then((x) => x.text()),
    fetch("/static/samples/job.txt").then((x) => x.text()),
  ]);
  fileInput.value = ""; showFile();
  $("#resume_text").value = r; $("#job_text").value = j;
});

// ---------------------------------------------------------------- run the agent
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  go.disabled = true; go.textContent = "Optimizing…";
  steps.replaceChildren(el("li", { class: "running" }, "Parsing resume and job description"));
  errorBox.classList.add("hidden");
  $("#progress").classList.remove("hidden");
  results.classList.add("hidden");

  try {
    const res = await fetch("/api/optimize", { method: "POST", body: new FormData(form) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
    }
    await readNdjson(res, (msg) => {
      if (msg.event === "step") addStep(msg.label);
      else if (msg.event === "result") render(msg.report, msg.markdown);
      else if (msg.event === "error") throw new Error(msg.message);
    });
  } catch (err) {
    steps.querySelector(".running")?.remove();
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  } finally {
    go.disabled = false; go.textContent = "Optimize resume";
  }
});

async function readNdjson(res, onMessage) {
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (line) onMessage(JSON.parse(line));
    }
  }
}

function addStep(label) {
  const running = steps.querySelector(".running");
  if (running) running.remove();
  steps.append(el("li", {}, "✓ ", label));
  if (label !== "Report ready") steps.append(el("li", { class: "running" }, "Working"));
}

// ---------------------------------------------------------------- render the report
function ring(score) {
  const r = 64, c = 2 * Math.PI * r, color = score >= 75 ? "var(--met)" : score >= 50 ? "var(--partial)" : "var(--missing)";
  const svg = `<svg class="ring" viewBox="0 0 160 160" role="img" aria-label="Overall match ${score} of 100">
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--line)" stroke-width="14"/>
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${(c * score) / 100} ${c}" transform="rotate(-90 80 80)"/>
    <text x="80" y="88" text-anchor="middle" font-size="34">${score}</text>
    <text x="80" y="110" text-anchor="middle" font-size="12" style="fill:var(--muted)">/ 100</text></svg>`;
  return el("div", {}, document.createRange().createContextualFragment(svg)); // numbers only
}

function bar(label, value) {
  const fill = el("span"); fill.style.width = `${value}%`;
  return el("div", {}, el("div", { class: "bar-label" }, el("span", {}, label), el("strong", {}, `${value}%`)),
    el("div", { class: "bar" }, fill));
}

function copyBtn(text) {
  return el("button", { class: "small ghost", type: "button", onclick: (e) => {
    navigator.clipboard.writeText(text); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1200);
  } }, "Copy");
}

function chips(items, cls = "") {
  return el("div", { class: "chips" }, items.map((t) => el("span", { class: `chip ${cls}` }, t)));
}

function render(r, markdown) {
  const { score: s, plan: p, job, analysis: a } = r;
  const download = el("button", { type: "button", class: "ghost", onclick: () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    el("a", { href: url, download: "resume-optimization.md" }).click();
    URL.revokeObjectURL(url);
  } }, "Download report (.md)");

  const reqRows = job.requirements.map((req, i) => {
    const m = a.matches[i];
    return el("tr", {},
      el("td", {}, el("span", { class: `pill ${m.status}` }, m.status)),
      el("td", {}, req.text),
      el("td", { class: "imp" }, req.importance.replace("_", " ")),
      el("td", {}, m.evidence ? el("div", { class: "evidence" }, `“${m.evidence}”`) : null,
        el("div", { class: "note" }, m.note)));
  });

  results.replaceChildren(
    el("section", { class: "card overview" },
      ring(s.overall),
      el("div", {},
        el("p", { class: "job-line" }, `${job.title}${job.company ? " · " + job.company : ""} · ${job.seniority}`),
        el("div", { class: "bars" },
          bar("Must-have requirements", s.must_have),
          bar("Nice-to-have requirements", s.nice_to_have),
          bar("ATS keyword coverage", s.keyword_coverage)),
        el("p", {}, download))),

    el("div", { class: "grid2" },
      el("section", { class: "card" }, el("h2", {}, "Strengths"), el("ul", { class: "plain" }, a.strengths.map((x) => el("li", {}, x)))),
      el("section", { class: "card" }, el("h2", {}, "Keywords"),
        el("h3", {}, "Found in your resume"), chips(s.matched_keywords, "good"),
        el("h3", { style: "margin-top:12px" }, "Missing from your resume"), chips(s.missing_keywords, "bad"),
        p.keywords_to_add.length ? [el("h3", { style: "margin-top:12px" }, "You can honestly add"), chips(p.keywords_to_add)] : null)),

    el("section", { class: "card" }, el("h2", {}, "Requirement match"),
      el("table", { class: "reqs" },
        el("thead", {}, el("tr", {}, el("th", {}, "Status"), el("th", {}, "Requirement"), el("th", {}, "Importance"), el("th", {}, "Evidence"))),
        el("tbody", {}, reqRows))),

    el("section", { class: "card" },
      el("div", { class: "row-head" }, el("h2", {}, "Tailored summary"), copyBtn(p.tailored_summary)),
      el("p", { class: "summary" }, p.tailored_summary)),

    el("section", { class: "card" }, el("h2", {}, "Bullet rewrites"),
      p.bullet_rewrites.length ? p.bullet_rewrites.map((b) => el("div", { class: "rewrite" },
        el("p", { class: "before" }, b.original),
        el("div", { class: "row-head" }, el("p", { class: "after" }, b.rewritten), copyBtn(b.rewritten)),
        el("p", { class: "why" }, b.reason, b.keywords_added.length ? ` · adds: ${b.keywords_added.join(", ")}` : "")))
        : el("p", { class: "note" }, "No safe rewrites were produced.")),

    el("div", { class: "grid2" },
      el("section", { class: "card" }, el("h2", {}, "Closing the gaps"),
        p.gap_advice.length ? el("ul", { class: "plain" }, p.gap_advice.map((g) => el("li", {}, el("strong", {}, g.requirement), ": ", g.advice)))
          : el("p", { class: "note" }, "No significant gaps.")),
      el("section", { class: "card" }, el("h2", {}, "Skills to lead with"), chips(p.skills_to_highlight, "good"),
        el("h2", { style: "margin-top:16px" }, "ATS tips"), el("ul", { class: "plain" }, p.ats_tips.map((t) => el("li", {}, t))))),

    r.guard_issues.length ? el("section", { class: "card guard" },
      el("h2", {}, `Honesty guard removed ${r.guard_issues.length} item(s)`),
      el("p", { class: "note" }, `After ${r.revisions} revision(s), these suggestions still claimed things the resume does not show, so they were dropped:`),
      el("ul", { class: "plain" }, r.guard_issues.map((i) => el("li", {}, i.detail)))) : null,
  );
  results.classList.remove("hidden");
  results.scrollIntoView({ behavior: "smooth" });
}
