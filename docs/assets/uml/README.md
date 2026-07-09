# UML Assets

UML diagrams are authored as **Mermaid**, embedded directly in the Markdown pages
under [`../../uml/`](../../uml/) (behavioural diagrams) and
[`../../design/data-model.md`](../../design/data-model.md) (data-layer class
models). GitHub renders them inline and the specification PDF renders the same
blocks, so there is no separate source or export step.

This folder is therefore **not** used for diagram sources. It only needs to hold
optional exported images (e.g. a `*.svg` render committed for use outside GitHub);
none are required today.

> Earlier plan note: the project briefly intended PlantUML `.puml` sources here.
> That was superseded by inline Mermaid — see [`../../uml/README.md`](../../uml/README.md).
