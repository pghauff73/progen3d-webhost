<?php
require __DIR__ . '/includes/bootstrap.php';
$sections = site_reference_sections();
render_header('Reference', 'reference');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Comprehensive reference</span>
      <h1>Grammar operators, structures, and workflow controls</h1>
      <p class="page-intro">This page summarises the grammar constructs that are visibly supported in the current ProGen3D live-site build and the wrapped modular editor.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="docs.php">Documentation</a>
      <a class="btn btn-primary" href="examples.php">Examples to copy</a>
    </div>
  </section>

  <section class="section-band">
    <strong>How to read this page</strong>
    <p class="muted">
      This page reflects the current live parser and runtime rather than an idealised older syntax sketch.
      Use the quick-reference cards below for operator behavior, then use the compact grammar summary here to understand the structural surface the parser accepts.
    </p>
  </section>

  <section class="reference-card" id="bnf-grammar">
    <h2>Current grammar summary</h2>
    <p class="muted">
      The parser supports the structural forms below. Expressions may contain spaces, tabs, newlines, and carriage returns,
      and conditional branches may contain inline statement lists when a top-level <code>:</code> is present.
    </p>

    <div class="reference-table">
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;grammar&gt;</code></div>
        <div>The complete grammar document, consisting of one or more rules.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;rule&gt;</code></div>
        <div>A named production that expands into a rule body.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;sequence&gt;</code></div>
        <div>An ordered list of statements executed procedurally.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;statement&gt;</code></div>
        <div>A grouped block, transform, deformation, instance, conditional, rule call, or variable form.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;expression&gt;</code></div>
        <div>An arithmetic expression used in transforms, conditions, variables, and rule arguments.</div>
      </div>
    </div>

<pre><code>&lt;grammar&gt; ::= &lt;rule&gt;+

&lt;rule&gt; ::= &lt;rule_header&gt; "-&gt;" &lt;rule_body&gt;
&lt;rule_header&gt; ::= &lt;identifier&gt;
                | &lt;identifier&gt; "(" &lt;var_list&gt; ")"
                | &lt;identifier&gt; "(" &lt;var_list&gt; ")" &lt;repeat_expr&gt;

&lt;rule_body&gt; ::= &lt;sequence&gt; ("|" &lt;sequence&gt;){0,2}
&lt;sequence&gt; ::= &lt;statement&gt;+

&lt;statement&gt; ::= "[" &lt;sequence&gt; "]"
              | &lt;transform&gt;
              | &lt;deformation&gt;
              | &lt;instance&gt;
              | &lt;conditional&gt;
              | &lt;rule_call&gt;
              | &lt;variable_stmt&gt;

&lt;conditional&gt; ::= "?(" &lt;expression&gt; ")" &lt;rule_call&gt;
                | "?(" &lt;expression&gt; ")" &lt;sequence&gt; ":" &lt;sequence&gt;

&lt;transform&gt; ::= "T" "(" &lt;expr&gt; &lt;expr&gt; &lt;expr&gt; ")"
              | "S" "(" &lt;expr&gt; &lt;expr&gt; &lt;expr&gt; ")"
              | ("A" | "R") "(" &lt;expr&gt; &lt;axis&gt; ")"

&lt;deformation&gt; ::= ("DSX" | "DSY" | "DSZ" | "DTX" | "DTY" | "DTZ")
                   "(" &lt;expr&gt; &lt;expr&gt; &lt;expr&gt; ")"
                | ("GDSX" | "GDSY" | "GDSZ" | "GDTX" | "GDTY" | "GDTZ")
                   "(" &lt;expr&gt; &lt;expr&gt; &lt;expr&gt; ")"

&lt;instance&gt; ::= "I" "(" ("Cube" | "CubeX" | "CubeY" | "CubeZ") &lt;texture_name&gt; &lt;expr&gt; ")"
&lt;texture_name&gt; ::= &lt;preset_name&gt; | &lt;joined_texture_name&gt;

&lt;rule_call&gt; ::= &lt;identifier&gt; | &lt;identifier&gt; "(" &lt;arg_list&gt; ")"
&lt;variable_stmt&gt; ::= &lt;identifier&gt; "(" &lt;arg_list&gt; ")"

&lt;arg_list&gt; ::= &lt;expr&gt; ((","? | whitespace)+ &lt;expr&gt;)*
&lt;var_list&gt; ::= &lt;identifier&gt; ((","? | whitespace)+ &lt;identifier&gt;)*

&lt;expr&gt; ::= arithmetic expression with identifiers, numbers, unary "-", parentheses,
           +, -, *, /, ^, comparisons, and functions such as sin, cos, sqrt, rand, float, int

whitespace inside expressions may include spaces, tabs, newlines, and carriage returns</code></pre>

    <p class="muted">
      For the full current text forms, see <code>BNF.txt</code> and <code>grammar-reference.txt</code> in the project root.
    </p>
  </section>

  <section class="reference-card">
    <h2>BNF-oriented syntax explanations</h2>
    <p class="muted">
      These notes explain the operator surface using the same formal language categories described in the BNF, so the
      documentation matches the parser model more closely.
    </p>

    <div class="reference-table">
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;rule&gt; ::= &lt;rule_header&gt; "-&gt;" &lt;rule_body&gt;</code></div>
        <div>A rule is the primary production unit. It maps a named header to a sequence or set of alternative sequences.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;statement&gt; ::= ...</code></div>
        <div>Every executable grammar element occupies statement position, including transforms, grouped branches, conditionals, and instances.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;group_block&gt; ::= "[" &lt;sequence&gt; "]"</code></div>
        <div>A grouped block isolates a local branch of procedural structure and is commonly used to contain transform accumulation and scoped global subset deformation.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;conditional&gt; ::= "?(" &lt;expression&gt; ")" ...</code></div>
        <div>Conditionals support both the legacy single-rule form and inline true/false statement lists split by a top-level colon.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;instance&gt; ::= "I" "(" &lt;primitive&gt; &lt;texture&gt; &lt;number&gt; ")"</code></div>
        <div>An instance binds geometry type, texture preset, and scalar value into a compact renderable statement. <code>CubeX</code>, <code>CubeY</code>, and <code>CubeZ</code> also advance the local transform by one unit along their own axis after each instance.</div>
      </div>
      <div class="reference-row">
        <div class="reference-syntax"><code>&lt;expression&gt; ::= &lt;add_expr&gt;</code></div>
        <div>Expressions define arithmetic structure for dimensions, recurrence, radial offsets, tapering, and conditional tests, and may span multiple lines.</div>
      </div>
    </div>
  </section>

  <section class="reference-grid">
    <?php foreach ($sections as $section): ?>
      <article class="reference-card">
        <h2><?= e($section['title']) ?></h2>
        <p class="muted"><?= e($section['intro']) ?></p>
        <div class="reference-table">
          <?php foreach ($section['items'] as $item): ?>
            <div class="reference-row">
              <div class="reference-syntax"><code><?= e($item['syntax']) ?></code></div>
              <div><?= e($item['meaning']) ?></div>
            </div>
          <?php endforeach; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </section>

  <section class="section-band">
    <strong>Practical note</strong>
    <p class="muted">The public site pages document the active workflow and operator surface that are visible in this packaged build. For deeper internals, the embedded editor still includes the original class reference and structure archetype documents inside <code>assets/editor/docs/</code>.</p>
  </section>
</main>
<?php render_footer(); ?>
