#!/usr/bin/env python3
import re, os, html, markdown

REPO = os.environ.get("PALEO_REPO", "/home/user/paleo-map")
MDX = dict(extensions=["tables", "fenced_code", "sane_lists"])
def md2html(t): return markdown.markdown(t, **MDX)
def read(p): return open(os.path.join(REPO, p), encoding="utf-8").read()

# ---- single source of truth: behavioural Mermaid diagrams are read straight
# from the repo UML pages, keyed by an HTML-comment marker they carry:
#   <!-- pdf-fig: KEY | Caption --> immediately before a ```mermaid block.
UML_SOURCES = [
    "docs/uml/use-case-diagram.md",
    "docs/uml/activity-diagrams.md",
    "docs/uml/state-diagrams.md",
    "docs/uml/sequence-diagrams.md",
]
DGM = {}
_marker = re.compile(
    r'<!--\s*pdf-fig:\s*([\w-]+)\s*\|\s*(.*?)\s*-->\s*```mermaid\n(.*?)```', re.S)
for _f in UML_SOURCES:
    for _m in _marker.finditer(read(_f)):
        DGM[_m.group(1)] = (_m.group(2).strip(), _m.group(3).strip())

# ---- figure helpers ----
figno = [0]
def fig_dgm(key):
    figno[0] += 1
    title, defn = DGM[key]
    return (f'<figure class="fig dgm">\n<div class="mermaid">{html.escape(defn)}</div>\n'
            f'<figcaption>Figure {figno[0]} — {html.escape(title)}</figcaption></figure>')
def fig_ui(name, label):
    figno[0] += 1
    svg = open(os.path.join(REPO, f"docs/assets/mockups/{name}.svg"), encoding="utf-8").read()
    svg = re.sub(r'^<\?xml[^>]*\?>\s*', '', svg).strip()
    return (f'<figure class="fig ui">\n<div class="uiwrap">{svg}</div>\n'
            f'<figcaption>Figure {figno[0]} — UI mockup: {html.escape(label)}</figcaption></figure>')

FIGS = {
 "1.1 Main exploration view": [("ui","exploration-view","Exploration view"),
                               ("dgm","usecase"), ("dgm","act_explore")],
 "1.6 Taxon and species profile": [("ui","taxon-profile","Taxon profile"), ("dgm","seq_occurrence")],
 "1.8 Search and filters": [("ui","filters-panel","Filters panel"), ("dgm","act_filter"), ("dgm","state_filter")],
 "1.9 Locations, occurrences and formations": [("ui","occurrence-panel","Occurrence panel")],
 "1.10 Navigation between content": [("dgm","act_occurrence"), ("dgm","seq_search")],
 "1.13 Interface states": [("ui","empty-error-states","Empty & error states"), ("dgm","state_map"), ("dgm","state_profile")],
}
FIGS_H2 = {}
# The data-layer class diagrams (provenance, taxonomy, occurrence, time, profile) live
# in the Data architecture chapter (docs/design/data-model.md), consolidated by subsystem.

def render_figs(items):
    out = []
    for it in items:
        if it[0] == "dgm": out.append(fig_dgm(it[1]))
        else: out.append(fig_ui(it[1], it[2]))
    return "\n".join(out)

# ---- parse functional spec into ordered heading/body tokens ----
spec = read("docs/product/functional-specification.md")
spec = re.sub(r'## Table of contents.*?\n---\n', '', spec, flags=re.S)
spec = re.sub(r'^# .*\n', '', spec, count=1)

sections = []  # list of (level, title, body_lines)
cur = ("intro", "", [])
for line in spec.split("\n"):
    m2 = re.match(r'## (.+)', line); m3 = re.match(r'### (.+)', line)
    if m2:
        sections.append(cur); cur = ("h2", m2.group(1).strip(), [])
    elif m3:
        sections.append(cur); cur = ("h3", m3.group(1).strip(), [])
    else:
        cur[2].append(line)
sections.append(cur)

parts = []
for level, title, body in sections:
    body_html = md2html("\n".join(body).strip()) if any(b.strip() for b in body) else ""
    if level == "intro":
        if body_html: parts.append(f'<div class="intro">{body_html}</div>')
        continue
    tag = "h2" if level == "h2" else "h3"
    parts.append(f'<{tag}>{html.escape(title)}</{tag}>')
    if body_html: parts.append(body_html)
    if level == "h2" and title in FIGS_H2: parts.append(render_figs(FIGS_H2[title]))
    if level == "h3" and title in FIGS: parts.append(render_figs(FIGS[title]))
SPEC_HTML = "\n".join(parts)

def chapter(title, body_html, cls="chapter"):
    return f'<section class="{cls}"><h1>{html.escape(title)}</h1>\n{body_html}</section>'

def appendix(title, mdpath):
    raw = read(mdpath)
    raw = re.sub(r'^# .*\n', '', raw, count=1)  # drop doc h1
    return chapter(title, md2html(raw), cls="chapter appendix")

def design_chapter(title, mdpath):
    raw = read(mdpath)
    raw = re.sub(r'^# .*\n', '', raw, count=1)  # drop doc h1
    body_html = md2html(raw)
    # turn ```mermaid fenced blocks into rendered mermaid figures
    def to_fig(m):
        return ('<figure class="fig dgm"><div class="mermaid">'
                + html.unescape(m.group(1)).strip()
                + '</div></figure>')
    body_html = re.sub(r'<pre><code class="language-mermaid">(.*?)</code></pre>',
                       to_fig, body_html, flags=re.S)
    return chapter(title, body_html, cls="chapter")

VISION = re.sub(r'^# .*\n', '', read("docs/product/vision.md"), count=1)

cover = """
<section class="cover">
  <div class="cv-kicker">Interactive Mesozoic Dinosaur Atlas</div>
  <h1 class="cv-title">Functional Specification</h1>
  <div class="cv-sub">Version 2 &middot; with UML models and UI mockups in place</div>
  <div class="cv-rule"></div>
  <dl class="cv-meta">
    <div><dt>Document</dt><dd>Specification &middot; UML &middot; UI</dd></div>
    <div><dt>Scope</dt><dd>MVP, V1 &amp; V2 requirements</dd></div>
    <div><dt>Date</dt><dd>2026-07-08</dd></div>
    <div><dt>Status</dt><dd>Requirement IDs are authoritative</dd></div>
  </dl>
  <p class="cv-note">Requirement IDs (FONC- / CONS- / PERF-) are stable and normative.
  UML diagrams and UI mockups illustrate the requirements; where they differ, the
  requirement text governs. UI mockups follow the project design charter (a light
  deep-time cartographic system).</p>
</section>
"""

contents = """
<section class="chapter toc">
  <h1>Contents</h1>
  <ol class="toc-list">
    <li>Product vision</li>
    <li>Functional specification
      <ol>
        <li>Conventions &amp; glossary</li>
        <li>Features — with domain model, use case, activity, state &amp; sequence UML and UI mockups</li>
        <li>Constraints</li>
        <li>Performance</li>
        <li>MVP scope &amp; out-of-scope</li>
      </ol>
    </li>
    <li>Data architecture &amp; model (design) — sources (PBDB + Wikipedia), the
      three data tiers, the assertion/provenance pattern &amp; typed class models</li>
    <li>Appendix A — Requirements index</li>
    <li>Appendix B — Requirements traceability</li>
    <li>Appendix C — Acceptance criteria</li>
    <li>Appendix D — Glossary</li>
  </ol>
  <p class="toc-note">Figures are numbered sequentially. UML is rendered with Mermaid
  (typed class models with composition/aggregation, plus use case, activity, state
  &amp; sequence diagrams); UI mockups are the project's high-fidelity SVG screens.
  Decisions on earlier ambiguities are folded into the requirements themselves.</p>
</section>
"""

body = "\n".join([
  cover, contents,
  chapter("Product vision", md2html(VISION)),
  chapter("Functional specification", SPEC_HTML),
  design_chapter("Data architecture & model (design)", "docs/design/data-model.md"),
  appendix("Appendix A — Requirements index", "docs/requirements/requirements-index.md"),
  appendix("Appendix B — Requirements traceability", "docs/requirements/requirements-traceability.md"),
  appendix("Appendix C — Acceptance criteria", "docs/requirements/acceptance-criteria.md"),
  appendix("Appendix D — Glossary", "docs/product/glossary.md"),
])

MERMAID = open("node_modules/mermaid/dist/mermaid.min.js", encoding="utf-8").read()

CSS = """
:root{ --ink:#1f2b38; --muted:#5f7180; --faint:#7c8b98; --line:#cfd8de;
  --teal:#0f9d83; --bg:#ffffff; --panel:#f6f8fa; --violet:#8E5AA5; --blue:#3E93C6; }
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact; print-color-adjust:exact}
body{margin:0;color:var(--ink);background:#fff;
  font-family:'IBM Plex Sans','Helvetica Neue',Arial,sans-serif;
  font-size:10.5pt;line-height:1.5;}
h1,h2,h3,.cv-title{font-family:'Spectral','Charter','Georgia',serif;font-weight:600;color:var(--ink);}
code,.mono,pre{font-family:'IBM Plex Mono','SFMono-Regular',Menlo,monospace;}
.chapter{page-break-before:always;}
.chapter h1{font-size:22pt;margin:0 0 14pt;padding-bottom:6pt;border-bottom:2px solid var(--teal);}
h2{font-size:15pt;margin:18pt 0 6pt;color:#0c8f76;}
h3{font-size:12.5pt;margin:14pt 0 4pt;}
p{margin:6pt 0;}
ul,ol{margin:6pt 0 6pt 0;padding-left:20pt;}
li{margin:2.5pt 0;}
strong{color:var(--ink);}
.intro blockquote,blockquote{margin:8pt 0;padding:6pt 12pt;background:var(--panel);
  border-left:3px solid var(--teal);color:var(--muted);font-size:9.5pt;}
a{color:#0c8f76;text-decoration:none;}
table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:8.3pt;}
th,td{border:1px solid var(--line);padding:3pt 5pt;text-align:left;vertical-align:top;}
th{background:var(--panel);font-weight:600;}
tr{page-break-inside:avoid;}
/* figures */
.fig{margin:12pt 0 14pt;page-break-inside:avoid;text-align:center;}
figcaption{font-size:8.5pt;color:var(--muted);margin-top:5pt;font-style:italic;}
.dgm .mermaid{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10pt;}
.dgm .mermaid svg{max-width:100%;height:auto;}
.ui .uiwrap{border:1px solid var(--line);border-radius:8px;padding:8pt;background:#eef2f5;}
.ui svg{width:100%;height:auto;display:block;border-radius:5px;}
/* cover */
.cover{height:246mm;display:flex;flex-direction:column;justify-content:center;
  page-break-after:always;}
.cv-kicker{font-family:'IBM Plex Mono',monospace;letter-spacing:2.5px;text-transform:uppercase;
  color:var(--teal);font-size:10pt;margin-bottom:10pt;}
.cv-title{font-size:40pt;line-height:1.02;margin:0;}
.cv-sub{color:var(--muted);font-size:13pt;margin-top:8pt;}
.cv-rule{height:3px;width:64pt;background:var(--teal);margin:18pt 0;}
.cv-meta{display:grid;grid-template-columns:1fr 1fr;gap:8pt 24pt;max-width:360pt;margin:0 0 20pt;}
.cv-meta div{border-top:1px solid var(--line);padding-top:5pt;}
.cv-meta dt{font-family:'IBM Plex Mono',monospace;font-size:7.5pt;letter-spacing:1px;
  text-transform:uppercase;color:var(--faint);}
.cv-meta dd{margin:2pt 0 0;font-size:10.5pt;}
.cv-note{max-width:430pt;color:var(--muted);font-size:9pt;}
.toc-list{font-size:11pt;line-height:1.9;} .toc-list ol{font-size:10pt;line-height:1.7;}
.toc-note{color:var(--muted);font-size:9pt;margin-top:10pt;}
"""

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>{CSS}</style></head><body>
{body}
<script>{MERMAID}</script>
<script>
mermaid.initialize({{ startOnLoad:false, theme:'base', securityLevel:'loose',
  flowchart:{{htmlLabels:true, curve:'basis'}},
  themeVariables:{{
    fontFamily:"'IBM Plex Sans','Helvetica Neue',Arial,sans-serif", fontSize:'13px',
    primaryColor:'#eef4f7', primaryBorderColor:'#0f9d83', primaryTextColor:'#1f2b38',
    lineColor:'#5f7180', secondaryColor:'#eef2f5', tertiaryColor:'#f6f8fa',
    noteBkgColor:'#f6ecd6', noteBorderColor:'#dcc58f',
    actorBkg:'#0f9d83', actorTextColor:'#ffffff', actorBorder:'#0c8f76',
    clusterBkg:'#f6f8fa', clusterBorder:'#cfd8de',
    labelBoxBkgColor:'#eef2f5', labelBoxBorderColor:'#cfd8de'
  }}
}});
mermaid.run({{querySelector:'.mermaid'}}).then(()=>{{window.__done=true;}})
  .catch(e=>{{window.__err=String(e);window.__done=true;}});
</script>
</body></html>"""

open("spec-document.html", "w", encoding="utf-8").write(doc)
print("wrote spec-document.html", len(doc), "bytes; figures:", figno[0])
