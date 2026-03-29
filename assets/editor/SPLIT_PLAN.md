
# Grammar Reader WebGLr2 — Suggested breakup plan

This package keeps the original source untouched and creates a modular version alongside a line-range plan.

## Recommended top-level split

| New file | Original line range(s) | Purpose |
|---|---:|---|
| `editor-modular.html` | 853-1060, 1737-1780, plus new shell | Main editor page only |
| `css/editor.css` | 48-850, 1783-2377 | Main editor styling |
| `docs/class-reference.html` | 1147-1563 | Move embedded five-page reference out of the editor page |
| `docs/structure-archetypes.html` | 1612-1734 | Move structure archetypes out of the editor page |
| `css/docs.css` | 1064-1144, 1568-1610 | Styling for the extracted docs pages |

## JavaScript breakup

| New file | Original line range(s) | Purpose |
|---|---:|---|
| `js/core/helpers.js` | 2583-2621 | Shared `log2`, `Mat4`, `Vec3` helpers |
| `js/core/renderer.js` | 2624-3377 | `WebGLSceneRenderer` and texture/render pipeline |
| `js/core/scene.js` | 3379-3515 | `Axis`, `Scene`, `transformPoint` |
| `js/core/scope-context.js` | 3517-3685 | `Scope`, `Context`, error classes |
| `js/core/variables.js` | 3687-3742 | Variable store and helpers |
| `js/core/substitution.js` | 3744-3808 | Variable substitution and math bridge |
| `js/core/math-eval.js` | 3810-4021 | RNG, `Solution`, math evaluator utilities |
| `js/core/lexer-token.js` | 4023-4459 | `GrammarLexer`, `Token`, `Rule` |
| `js/core/grammar.js` | 4461-5002 | `Grammar`, block collection, `prepare()` |
| `js/app/pretty-print.js` | 5004-5025 | Debug/scene pretty-print helpers |
| `js/app/editor-app.js` | 5027-5301 | Main UI controller, run/clear/orbit/tutorial wiring |
| `js/app/storage.js` | 5839-5971 | Save/load chooser using `localStorage` |

## Keep optional, do not load by default

| Optional file | Original line range(s) | Why it should stay optional |
|---|---:|---|
| `js/optional/legacy-storage-basic.js` | 2381-2461 | Overlaps with the newer storage handler |
| `js/optional/smart-editor-v0.4.js` | 5303-5837 | Dead on arrival in the original page because `#codewrap` already has `data-se-init="1"` |
| `js/optional/progen3d-grammar-generator.js` | 5973-6864 | Experimental generator library, not required for the editor runtime |
| `js/optional/progen3d-unified-grammar.js` | 6866-8473 | Experimental unified generator library |

## Cleanup notes

- The original page mixes the live editor with two embedded documentation sections and a second content page, making the editor heavier than it needs to be.
- The appointment scheduling script appears twice, once in the hero and once again in the footer.
- `site.js` is included twice at the bottom of the original page.
- Two different global `ProGen3DGrammar` class definitions appear in the large experimental sections; keeping those out of the main runtime avoids accidental overwrites.
- The newer storage block had one typo (`namechooser`) which is fixed in the modular version.
