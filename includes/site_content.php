<?php

function site_reference_sections(): array
{
    return [
        [
            'title' => 'Rule structure',
            'intro' => 'Every grammar starts with one or more rules. The live parser supports rule headers, sequences, alternates, grouped blocks, conditional branches, calls, transforms, local and global deformations, instances, and expression-based arguments.',
            'items' => [
                ['syntax' => 'Start -> body', 'meaning' => 'Defines a basic entry rule and sends execution into its body. Use this when you do not need resolved variables or an explicit repeat expression.'],
                ['syntax' => 'RuleName(var1 var2) -> rule_body', 'meaning' => 'Defines a parameterized rule using the BNF rule-header form. Parameter and argument lists can be whitespace-separated, with commas still accepted for compatibility.'],
                ['syntax' => 'RuleName(vars) repeat_expr -> rule_body', 'meaning' => 'Defines a parameterized rule followed by a repeat expression, matching the supplied BNF.'],
                ['syntax' => 'sequence | sequence | sequence', 'meaning' => 'A rule body can contain one, two, or three alternative sequences separated by pipes.'],
                ['syntax' => '?(cond_expr) Rule', 'meaning' => 'Single-branch conditional rule call. If cond_expr evaluates truthy, the named rule is executed; otherwise nothing is emitted from that conditional. This is useful for optional branches, bounded recursion, or one-sided feature toggles.'],
                ['syntax' => '?(cond_expr) stmt_list_true : stmt_list_false', 'meaning' => 'Two-branch inline conditional. When a top-level colon is present, each side can be a statement list, not just a single rule call. Use this for in-place recursion, termination branches, or compact structural switches.'],
                ['syntax' => '[ ... ]', 'meaning' => 'Creates a grouped structural block that can contain transforms, variables, conditionals, and instances as one composable unit inside a rule body. Groups clone parser state, so local and global deformation settings push on entry and pop on exit, and GDS*/GDT* affect only cubes emitted while that grouped state is active.'],
            ],
        ],
        [
            'title' => 'Transforms',
            'intro' => 'These operators change placement, scale, and orientation before an instance is emitted. For CubeX, CubeY, and CubeZ, the runtime also advances the local transform by one unit along that primitive axis after each instance.',
            'items' => [
                ['syntax' => 'T ( x y z )', 'meaning' => 'Translate in 3D space.'],
                ['syntax' => 'S ( sx sy sz )', 'meaning' => 'Scale on each axis.'],
                ['syntax' => 'A ( angle axis ) / R ( angle axis )', 'meaning' => 'Rotate by degrees where axis 0 = X, 1 = Y, 2 = Z. `R` is accepted as the same operator surface as `A`.'],
                ],
        ],
        [
            'title' => 'Axis deformation controls',
            'intro' => 'The runtime supports both per-instance axis deformation and subset-scoped global axis deformation.',
            'items' => [
                ['syntax' => 'DSX / DSY / DSZ ( x y z )', 'meaning' => 'Local axis deformation scale. These act on each emitted cube individually in primitive-local space.'],
                ['syntax' => 'DTX / DTY / DTZ ( x y z )', 'meaning' => 'Local axis deformation translation. These also act per emitted cube and compose with the matching local DS* state.'],
                ['syntax' => 'GDSX / GDSY / GDSZ ( x y z )', 'meaning' => 'Global subset deformation scale. The runtime deforms together only the cubes emitted under the same active scoped GDS*/GDT* state, using one shared bounding box for that subset.'],
                ['syntax' => 'GDTX / GDTY / GDTZ ( x y z )', 'meaning' => 'Global subset deformation translation. Use bracket groups to scope these operators so they affect only cubes emitted inside that active subset.'],
            ],
        ],
        [
            'title' => 'Instances and materials',
            'intro' => 'Geometry is produced through the instance operator. The current runtime supports four primitive identifiers, each followed by a texture name and scale value. CubeX, CubeY, and CubeZ also move the active transform forward by one local unit on X, Y, or Z after each instance.',
            'items' => [
                ['syntax' => 'I ( Cube texture scale )', 'meaning' => 'Instantiate a cube primitive with a texture preset and scalar value.'],
                ['syntax' => 'I ( CubeX texture scale )', 'meaning' => 'Instantiate an X-oriented beam-like cube, then advance the local transform by one unit along local X.'],
                ['syntax' => 'I ( CubeY texture scale )', 'meaning' => 'Instantiate a Y-oriented cube variant, then advance the local transform by one unit along local Y.'],
                ['syntax' => 'I ( CubeZ texture scale )', 'meaning' => 'Instantiate a Z-oriented beam-like cube, then advance the local transform by one unit along local Z.'],
                ['syntax' => 'I ( Cube brushedAluminum 0.35 )', 'meaning' => 'Use a named renderer texture preset directly in the instance call.'],
                ['syntax' => 'I ( Cube roughblueshinysemitransparentmetal 0.35 )', 'meaning' => 'Joined texture descriptors are also supported. Segments are read in fixed order: surface, color, reflectance, opacity, type, with any segment optional.'],
            ],
        ],
        [
            'title' => 'Textures',
            'intro' => 'The active renderer supports both named procedural presets and joined texture descriptors.',
            'items' => [
                ['syntax' => 'roughConcrete / smoothConcrete / crackedAsphalt / redBrickWall / whiteTiles / blueCeramicTile', 'meaning' => 'Structural and architectural surface presets.'],
                ['syntax' => 'shinySteel / brushedAluminum / oxidizedCopper / agedBronze / shinyGold / tarnishedSilver / rawIron / polishedTitanium / rustyMetal', 'meaning' => 'Metallic and industrial finishes.'],
                ['syntax' => 'clearGlass / frostedGlass / tintedGreenGlass / stainedBlueGlass', 'meaning' => 'Transparent and translucent clearGlass presets.'],
                ['syntax' => 'freshGrass / dryGrass / desertSand / muddySoil / grayStone / darkBasalt / whiteMarble / greenMarble', 'meaning' => 'Ground, stone, and landscape-style textures.'],
                ['syntax' => 'oakPlanks / darkWalnut / pineWood / mahoganyWood / cherryWood / mapleWood', 'meaning' => 'Wood and timber finishes.'],
                ['syntax' => 'iceBlock / moltenLava / deepWater / snowPowder / fluffyCloud / mossPatch / claySoil', 'meaning' => 'Elemental and atmospheric presets.'],
                ['syntax' => 'carbonFiber / circuitBoard / glowingPanel / hazardStripe / steelGrid / chromeSurface', 'meaning' => 'Sci-fi, technical, and industrial panel presets.'],
                ['syntax' => 'rough + blue + shiny + semitransparent + metal', 'meaning' => 'Joined descriptors are parsed in that fixed order and compressed into one token such as `roughblueshinysemitransparentmetal`. Any segment may be omitted.'],
                ['syntax' => 'Example: Start -> I ( Cube frostedGlass 0.22 )', 'meaning' => 'A compact example of applying a named texture preset in a grammar.'],
            ],
        ],
        [
            'title' => 'Expressions, calls, and variables',
            'intro' => 'Expressions drive variables, transforms, calls, and conditionals. The parser accepts identifiers, numbers, arithmetic, unary negation, grouping, and the supported functions directly inside argument lists.',
            'items' => [
                ['syntax' => 'RuleName( expr1 expr2 )', 'meaning' => 'Call a named rule with one or more expression arguments. Whitespace-separated lists are supported, and commas remain valid.'],
                ['syntax' => 'identifier( expr1 expr2 )', 'meaning' => 'A variable-style statement occupies statement position in the current BNF surface and may use the same multi-argument form.'],
                ['syntax' => 'x + y * z', 'meaning' => 'Inline arithmetic is supported inside transform arguments, calls, conditionals, and variable expression lists.'],
                ['syntax' => 'sin ( expr ) / cos ( expr ) / rand ( min max ) / rand ( var ) / float ( expr ) / int ( expr )', 'meaning' => 'The evaluator currently recognises trigonometric helpers, a runtime random range function, rerolls from declared R-variable ranges, plus numeric casts to float and truncated int values.'],
                ['syntax' => 'multiline expression', 'meaning' => 'Spaces, tabs, newlines, and carriage returns are all accepted inside expressions. Transform arguments and conditional expressions may span multiple lines.'],
                ['syntax' => 'spacing rule', 'meaning' => 'Spaces around brackets and parentheses are optional. `T(0 1 0)`, `T ( 0 1 0 )`, and `[Rule]` are all valid as long as tokens remain unambiguous.'],
            ],
        ],
        [
            'title' => 'Viewer and workflow',
            'intro' => 'The PHP site wraps the modular editor with account, file, and publishing workflow around the live WebGL scene.',
            'items' => [
                ['syntax' => 'Run Grammar', 'meaning' => 'Executes the current grammar and refreshes the scene.'],
                ['syntax' => 'Save', 'meaning' => 'Stores the current grammar in JSON-backed project storage under your account.'],
                ['syntax' => 'Publish to gallery', 'meaning' => 'Marks a file public so it appears in the gallery live viewer.'],
                ['syntax' => 'Fit View / Reset View', 'meaning' => 'Viewer controls adjust the camera around current scene bounds.'],
                ['syntax' => 'STL export', 'meaning' => 'The embedded editor still exposes STL export from the underlying WebGL toolchain.'],
            ],
        ],
    ];
}

function site_docs_sections(): array
{
    return [
        [
            'title' => 'Quick start workflow',
            'body' => [
                'Create an account with your email address, verify it with the emailed 6-digit code, then open the editor and write a grammar into the input panel. Save drafts privately while you iterate. When a piece is ready, publish it to the gallery so it becomes browsable in the live viewer.',
                'The PHP shell does not replace the original grammar runtime. It wraps the working modular editor so the same scene engine, SmartEditor, syntax highlighting, STL export, grid, axis widget, and orbit navigation remain available inside a proper site workflow.',
            ],
            'bullets' => [
                'Email-verified accounts with code-based confirmation',
                'Login-protected editor and file storage',
                'Public gallery for published grammars',
                'Read-only public viewer pages',
                'Copy-to-editor flow for remixing gallery work',
            ],
        ],
        [
            'title' => 'Account and recovery',
            'body' => [
                'Registration now stores an email address and requires email verification before normal login is allowed. If an unverified user tries to sign in, the site resends a verification code and routes them back to the verification page.',
                'The login screen also exposes a password reset flow. Users can request a 6-digit login code by username or email, choose a new password on the reset page, confirm it, and be logged in automatically after the reset succeeds.',
            ],
            'bullets' => [
                '6-digit verification codes expire after 15 minutes',
                'Password reset uses a separate emailed login code',
                'Successful publish events send an admin notification email',
                'New registrations also send an admin notification email',
            ],
        ],
        [
            'title' => 'Grammar authoring tips',
            'body' => [
                'Keep operators readable, but spaces around brackets are optional. The parser accepts forms such as `Tower(h)` and `[T(0 1 0)Part]` as long as the token boundaries stay unambiguous. Expressions may also contain spaces, tabs, newlines, and carriage returns, so multiline math is valid inside transforms and conditionals.',
                'Build from the simplest valid scene first. Start with a single instance, then add parameters, calls, transforms, grouped blocks, and conditionals one layer at a time. That makes scene debugging far easier than writing a large grammar and trying to reason about multiple changes at once.',
                'Use grouped blocks when you want scoped deformation behavior. Local DS*/DT* state and global GDS*/GDT* subset state both clone on group entry and restore on exit.',
            ],
            'bullets' => [
                'Start from one visible primitive',
                'Add transforms incrementally',
                'Use brackets to compose multi-part scenes',
                'Add parameters and conditional calls only after the base form renders correctly',
                'Use GDS*/GDT* inside groups when you want several cubes to deform together without affecting the whole scene',
            ],
        ],
        [
            'title' => 'Publishing and storage',
            'body' => [
                'This build now runs against Firebase-only storage at runtime. Firebase Auth signs users in, Firestore stores account and grammar metadata, and Cloud Storage stores the grammar source blobs.',
                'Because the site keeps authored grammar text rather than only baked geometry, published works can be previewed, opened in the public viewer, or copied back into a private editor session for further iteration.',
            ],
            'bullets' => [
                'Firebase Auth for account sign-in and verification',
                'Firestore for canonical user profiles and file metadata',
                'Cloud Storage for grammar source blobs',
                'Legacy JSON files remain offline migration input only',
                'Runtime storage now lives outside the public web root',
            ],
        ],
        [
            'title' => 'Scene viewer controls',
            'body' => [
                'The integrated viewer uses the custom SVEC orbit style that was patched into the project. Drag to orbit, use the wheel to zoom, and use the fit/reset controls to reframe the current grammar output. The XZ grid and orientation axis widget are always visible inside the active scene viewer.',
                'Published gallery pieces use the same viewer engine in read-only mode. That gives the live site a consistent visual language between authoring, browsing, and public presentation.',
            ],
            'bullets' => [
                'Drag to orbit',
                'Ctrl-drag or secondary drag to pan',
                'Wheel to zoom',
                'Fit View and Reset View for framing',
            ],
        ],
    ];
}

function site_examples(): array
{
    return [
        [
            'slug' => 'starter-cube',
            'title' => 'Starter cube',
            'summary' => 'The smallest valid starting point for checking that your pipeline, textures, and viewer are working.',
            'tags' => ['starter', 'primitive', 'material'],
            'grammar' => "Start -> I ( Cube brushedAluminum 0.5 )",
        ],
        [
            'slug' => 'parameterized-tower',
            'title' => 'Parameterized tower',
            'summary' => 'A simple parameterized rule using the canonical BNF rule-header and a helper call.',
            'tags' => ['parameters', 'tower', 'starter'],
            'grammar' => "Start -> Tower( 2.2 )\nTower( h ) -> S ( 1 h 1 ) I ( CubeY grayStone 0.35 )",
        ],
        [
            'slug' => 'conditional-branch',
            'title' => 'Conditional branch',
            'summary' => 'A compact example showing the BNF conditional form with helper rules and expression arguments.',
            'tags' => ['conditional', 'calls', 'bnf'],
            'grammar' => "Start -> Branch( 0.7 )\nBranch( amount ) -> ?( amount > 0.5 ) Tall : Short\nTall -> T ( 0 1 0 ) I ( Cube chromeSurface 0.3 )\nShort -> T ( 0 0.4 0 ) I ( Cube brushedAluminum 0.3 )",
        ],
        [
            'slug' => 'twin-towers',
            'title' => 'Twin towers',
            'summary' => 'A readable multi-part arrangement using bracket groups to place two towers and a connecting bridge.',
            'tags' => ['architecture', 'bridge', 'grouping'],
            'grammar' => "Start ->\n[ T ( -1.45 1.2 0 ) S ( 0.78 2.4 0.78 ) I ( Cube smoothConcrete 0.32 ) ]\n[ T ( 1.45 1.2 0 ) S ( 0.78 2.4 0.78 ) I ( Cube smoothConcrete 0.32 ) ]\n[ T ( 0 2.55 0 ) S ( 3.6 0.18 0.78 ) I ( Cube brushedAluminum 0.18 ) ]",
        ],
        [
            'slug' => 'pavilion-frame',
            'title' => 'Pavilion frame',
            'summary' => 'A low platform, four columns, and a canopy using only transforms and primitive instances.',
            'tags' => ['pavilion', 'columns', 'canopy'],
            'grammar' => "Start ->\n[ S ( 4 0.14 4 ) I ( Cube grayStone 0.24 ) ]\n[ T ( -1.5 1.15 -1.5 ) S ( 0.16 2.3 0.16 ) I ( Cube brushedAluminum 0.2 ) ]\n[ T ( 1.5 1.15 -1.5 ) S ( 0.16 2.3 0.16 ) I ( Cube brushedAluminum 0.2 ) ]\n[ T ( -1.5 1.15 1.5 ) S ( 0.16 2.3 0.16 ) I ( Cube brushedAluminum 0.2 ) ]\n[ T ( 1.5 1.15 1.5 ) S ( 0.16 2.3 0.16 ) I ( Cube brushedAluminum 0.2 ) ]\n[ T ( 0 2.4 0 ) S ( 3.7 0.16 3.7 ) I ( Cube clearGlass 0.12 ) ]",
        ],
        [
            'slug' => 'axis-deform',
            'title' => 'Axis deformation test',
            'summary' => 'A compact example showing the DSX/DSY/DSZ and DTX/DTY/DTZ controls in one place.',
            'tags' => ['deform', 'axis', 'advanced'],
            'grammar' => "Start -> DSX ( 1.22 1 1 ) DTX ( 0.14 0 0 ) DSY ( 1 0.84 1 ) DTY ( 0 0.18 0 ) DSZ ( 1 1 1.16 ) DTZ ( 0 0 0.22 ) I ( CubeZ brushedAluminum 0.52 )",
        ],
        [
            'slug' => 'rotated-cross',
            'title' => 'Rotated cross frame',
            'summary' => 'Uses rotation plus grouped beams to create a lightweight frame composition.',
            'tags' => ['rotation', 'frame', 'beams'],
            'grammar' => "Start ->\n[ S ( 0.2 0.2 5 ) I ( CubeZ oakPlanks 0.18 ) ]\n[ A ( 90 1 ) S ( 0.2 0.2 5 ) I ( CubeZ oakPlanks 0.18 ) ]\n[ A ( 45 1 ) S ( 0.18 0.18 4.2 ) I ( CubeZ brushedAluminum 0.16 ) ]\n[ A ( -45 1 ) S ( 0.18 0.18 4.2 ) I ( CubeZ brushedAluminum 0.16 ) ]",
        ],
        [
            'slug' => 'clearGlass-plinth',
            'title' => 'Glass plinth object',
            'summary' => 'A clean pedestal-style object for material checks and screenshot-friendly previews.',
            'tags' => ['render', 'clearGlass', 'display'],
            'grammar' => "Start ->\n[ S ( 2.2 0.18 2.2 ) I ( Cube grayStone 0.24 ) ]\n[ T ( 0 0.72 0 ) S ( 1 1.08 1 ) I ( Cube clearGlass 0.14 ) ]\n[ T ( 0 1.48 0 ) S ( 0.54 0.22 0.54 ) I ( Cube brushedAluminum 0.18 ) ]",
        ],
    ];
}

function site_example_by_slug(?string $slug): ?array
{
    $slug = trim((string) $slug);
    if ($slug === '') {
        return null;
    }
    foreach (site_examples() as $example) {
        if (($example['slug'] ?? '') === $slug) {
            return $example;
        }
    }
    return null;
}


function site_archetype_reference(): array
{
    return [
        'overview' => [
            'title' => 'Structural archetypes reference',
            'intro' => 'These archetypes turn common structural patterns into reusable ProGen3D motif families. Each motif is axis-aware, parameterized, and designed to compose cleanly with transforms, symmetry, recursion, and material presets.',
            'conventions' => [
                'Axis mapping: 0 = X, 1 = Y, 2 = Z.',
                'Shared variables usually include N (count), R (radius), H (levels), step (spacing), taper, twist, depth, primitive, and material.',
                'The pseudocode below is template-oriented rather than strict final parser syntax, so it can guide implementation, prompts, and copy-ready examples.',
            ],
        ],
        'categories' => [
            [
                'title' => 'Foundational motifs',
                'intro' => 'These are the core arrangement logics. Most higher-order motifs can be built from this layer.',
                'motifs' => [
                    [
                        'name' => 'Spokes',
                        'description' => 'Instances radiate around a central axis at equal angular intervals.',
                        'parameters' => ['N:int', 'R:float', 'axis:int', 'elementScale:float', 'jitterAngle:float', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['hubs', 'antennas', 'petals', 'radial bracing', 'canopies'],
                        'pseudocode' => "Spokes(N R axis elementScale jitterAngle primitive material) 1 ->\n    SpokesIter(0 N R axis elementScale jitterAngle primitive material)\n\nSpokesIter(i N R axis elementScale jitterAngle primitive material) ?(i < int(N)) ->\n    [\n        RotateAroundAxis(axis, 360*i/N + Rand(-jitterAngle,jitterAngle))\n        TranslateRadial(axis, R)\n        OrientRadially(axis, 360*i/N)\n        S(elementScale elementScale elementScale)\n        I(primitive material 1)\n    ]\n    SpokesIter(i+1 N R axis elementScale jitterAngle primitive material)",
                    ],
                    [
                        'name' => 'Ring',
                        'description' => 'A closed loop of repeated instances arranged around an axis.',
                        'parameters' => ['N:int', 'R:float', 'axis:int', 'thickness:float', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['collars', 'wheels', 'stadium edges', 'circular tiers', 'mechanical loops'],
                        'pseudocode' => "Ring(N R axis thickness primitive material) 1 ->\n    RingSeg(0 N R axis thickness primitive material)\n\nRingSeg(i N R axis thickness primitive material) ?(i < int(N)) ->\n    [\n        RotateAroundAxis(axis, 360*i/N)\n        TranslateRadial(axis, R)\n        OrientRadially(axis, 360*i/N)\n        S(thickness thickness thickness)\n        I(primitive material 1)\n    ]\n    RingSeg(i+1 N R axis thickness primitive material)",
                    ],
                    [
                        'name' => 'Band',
                        'description' => 'A linear sequence of repeated instances distributed along a span.',
                        'parameters' => ['N:int', 'span:float', 'axis:int', 'taper:float', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['facades', 'decks', 'ribs', 'beams', 'tracks'],
                        'pseudocode' => "Band(N span axis taper primitive material) 1 ->\n    BandSeg(0 N span axis taper primitive material)\n\nBandSeg(i N span axis taper primitive material) ?(i < int(N)) ->\n    [\n        t F(i N) InvLerp(i,N)\n        s F(t taper) Lerp(1,taper,t)\n        TranslateAlongAxis(axis, -span*0.5 + span*t)\n        S(s s s)\n        I(primitive material 1)\n    ]\n    BandSeg(i+1 N span axis taper primitive material)",
                    ],
                    [
                        'name' => 'Stack',
                        'description' => 'Repeating instances ascending along an axis.',
                        'parameters' => ['H:int', 'step:float', 'axis:int', 'taper:float', 'twist:float', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['towers', 'pagodas', 'pillars', 'segmented masts'],
                        'pseudocode' => "Stack(H step axis taper twist primitive material) 1 ->\n    StackLevel(0 H step axis taper twist primitive material)\n\nStackLevel(i H step axis taper twist primitive material) ?(i < int(H)) ->\n    [\n        t F(i H) InvLerp(i,H)\n        s F(t taper) Lerp(1,taper,t)\n        TranslateAlongAxis(axis, i*step)\n        RotateAroundAxis(axis, i*twist)\n        S(s s s)\n        I(primitive material 1)\n    ]\n    StackLevel(i+1 H step axis taper twist primitive material)",
                    ],
                    [
                        'name' => 'Grid',
                        'description' => 'A 2D lattice of repeated elements on a plane.',
                        'parameters' => ['Gx:int', 'Gy:int', 'cellSpanX:float', 'cellSpanY:float', 'planeAxis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['floors', 'facades', 'shelving', 'structural lattice fields'],
                        'pseudocode' => "Grid(Gx Gy cellSpanX cellSpanY planeAxis primitive material) 1 ->\n    GridRow(0 Gx Gy cellSpanX cellSpanY planeAxis primitive material)\n\nGridRow(ix Gx Gy cellSpanX cellSpanY planeAxis primitive material) ?(ix < int(Gx)) ->\n    GridCol(ix 0 Gx Gy cellSpanX cellSpanY planeAxis primitive material)\n    GridRow(ix+1 Gx Gy cellSpanX cellSpanY planeAxis primitive material)\n\nGridCol(ix iy Gx Gy cellSpanX cellSpanY planeAxis primitive material) ?(iy < int(Gy)) ->\n    [\n        PlaneTranslate(planeAxis, (ix-(Gx-1)/2)*cellSpanX, (iy-(Gy-1)/2)*cellSpanY)\n        I(primitive material 1)\n    ]\n    GridCol(ix iy+1 Gx Gy cellSpanX cellSpanY planeAxis primitive material)",
                    ],
                ],
            ],
            [
                'title' => 'Derived and compound motifs',
                'intro' => 'These motifs combine or deform foundational patterns into richer structural families.',
                'motifs' => [
                    [
                        'name' => 'RingStack',
                        'description' => 'Multiple rings stacked along an axis with optional scale ramping.',
                        'parameters' => ['rings:int', 'perRingN:int', 'R:float', 'ringStep:float', 'axis:int', 'scaleRamp:float', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['turbine cages', 'amphitheaters', 'ring towers', 'canopies'],
                        'pseudocode' => "RingStack(rings perRingN R ringStep axis scaleRamp primitive material) 1 ->\n    RingStackIter(0 rings perRingN R ringStep axis scaleRamp primitive material)\n\nRingStackIter(i rings perRingN R ringStep axis scaleRamp primitive material) ?(i < int(rings)) ->\n    [\n        t F(i rings) InvLerp(i,rings)\n        s F(t scaleRamp) Lerp(1,scaleRamp,t)\n        TranslateAlongAxis(axis, i*ringStep)\n        S(s s s)\n        Ring(perRingN R axis 1 primitive material)\n    ]\n    RingStackIter(i+1 rings perRingN R ringStep axis scaleRamp primitive material)",
                    ],
                    [
                        'name' => 'Spiral',
                        'description' => 'A helical band winding around an axis with pitch and radius control.',
                        'parameters' => ['N:int', 'turns:float', 'pitch:float', 'R0:float', 'dR:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['stairs', 'ramps', 'helix towers', 'DNA-like structures'],
                        'pseudocode' => "Spiral(N turns pitch R0 dR axis primitive material) 1 ->\n    SpiralSeg(0 N turns pitch R0 dR axis primitive material)\n\nSpiralSeg(i N turns pitch R0 dR axis primitive material) ?(i < int(N)) ->\n    [\n        t F(i N) InvLerp(i,N)\n        ang F(t turns) 360*turns*t\n        r F(t R0 dR) R0 + dR*t\n        RotateAroundAxis(axis, ang)\n        TranslateRadial(axis, r)\n        TranslateAlongAxis(axis, pitch*turns*t)\n        OrientRadially(axis, ang)\n        I(primitive material 1)\n    ]\n    SpiralSeg(i+1 N turns pitch R0 dR axis primitive material)",
                    ],
                    [
                        'name' => 'Fork',
                        'description' => 'A branching motif that splits a line or stack into multiple offspring.',
                        'parameters' => ['depth:int', 'branching:int', 'splitAngle:float', 'step:float', 'childScale:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['trees', 'branching frames', 'vascular systems', 'support bifurcations'],
                        'pseudocode' => "Fork(depth branching splitAngle step childScale axis primitive material) 1 ->\n    ForkNode(depth branching splitAngle step childScale axis primitive material)\n\nForkNode(depth branching splitAngle step childScale axis primitive material) 1 ->\n    [ I(primitive material 1) ]\n    ?(depth > 0) ForkChildren(depth branching splitAngle step childScale axis primitive material)\n\nForkChildren(depth branching splitAngle step childScale axis primitive material) 1 ->\n    ForkBranch(0 depth branching splitAngle step childScale axis primitive material)\n\nForkBranch(i depth branching splitAngle step childScale axis primitive material) ?(i < int(branching)) ->\n    [\n        RotateAroundPerpAxes(axis, SpreadAngle(i,branching,splitAngle))\n        TranslateAlongAxis(axis, step)\n        S(childScale childScale childScale)\n        ForkNode(depth-1 branching splitAngle step childScale axis primitive material)\n    ]\n    ForkBranch(i+1 depth branching splitAngle step childScale axis primitive material)",
                    ],
                    [
                        'name' => 'RadialGrid',
                        'description' => 'A polar lattice made from concentric rings crossed by spokes.',
                        'parameters' => ['ringCount:int', 'spokesCount:int', 'ringSpacing:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['plazas', 'stadium plans', 'solar layouts', 'radial truss networks'],
                        'pseudocode' => "RadialGrid(ringCount spokesCount ringSpacing axis primitive material) 1 ->\n    [ Spokes(spokesCount ringCount*ringSpacing axis 1 0 primitive material) ]\n    RadialRingIter(1 ringCount spokesCount ringSpacing axis primitive material)\n\nRadialRingIter(i ringCount spokesCount ringSpacing axis primitive material) ?(i <= int(ringCount)) ->\n    [ Ring(spokesCount i*ringSpacing axis 1 primitive material) ]\n    RadialRingIter(i+1 ringCount spokesCount ringSpacing axis primitive material)",
                    ],
                    [
                        'name' => 'Ribbon',
                        'description' => 'A band sampled along a curve or spline, suitable for skins and bridges.',
                        'parameters' => ['N:int', 'thickness:float', 'twist:float', 'curveFn:symbol', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['bridges', 'skins', 'ornament', 'aerodynamic strips'],
                        'pseudocode' => "Ribbon(N thickness twist curveFn axis primitive material) 1 ->\n    RibbonSeg(0 N thickness twist curveFn axis primitive material)\n\nRibbonSeg(i N thickness twist curveFn axis primitive material) ?(i < int(N)) ->\n    [\n        t F(i N) InvLerp(i,N)\n        CurveSample(curveFn, t)\n        CurveOrient(curveFn, t, axis)\n        RotateAroundLocalTangent(twist*t)\n        S(thickness thickness thickness)\n        I(primitive material 1)\n    ]\n    RibbonSeg(i+1 N thickness twist curveFn axis primitive material)",
                    ],
                ],
            ],
            [
                'title' => 'Architectural and system motifs',
                'intro' => 'These motifs encode built-form intent on top of the simpler arrangement families.',
                'motifs' => [
                    [
                        'name' => 'TerracedStack',
                        'description' => 'A stepped stack with progressive setbacks and shrinkage.',
                        'parameters' => ['floors:int', 'floorHeight:float', 'shrinkFactor:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['ziggurats', 'setback towers', 'layered massing studies'],
                        'pseudocode' => "TerracedStack(floors floorHeight shrinkFactor axis primitive material) 1 ->\n    TerraceLevel(0 floors floorHeight shrinkFactor axis primitive material)\n\nTerraceLevel(i floors floorHeight shrinkFactor axis primitive material) ?(i < int(floors)) ->\n    [\n        s F(i shrinkFactor) pow(shrinkFactor,i)\n        TranslateAlongAxis(axis, i*floorHeight)\n        S(s 1 s)\n        I(primitive material 1)\n    ]\n    TerraceLevel(i+1 floors floorHeight shrinkFactor axis primitive material)",
                    ],
                    [
                        'name' => 'FaçadeBandGrid',
                        'description' => 'A facade system combining horizontal bands and a vertical grid of panels or mullions.',
                        'parameters' => ['rows:int', 'cols:int', 'rowStep:float', 'colStep:float', 'mullionThick:float', 'panelScale:float', 'planeAxis:int', 'panelPrimitive:symbol', 'mullionPrimitive:symbol', 'material:symbol'],
                        'uses' => ['curtain walls', 'window rows', 'facade studies', 'modular wall systems'],
                        'pseudocode' => "FacadeBandGrid(rows cols rowStep colStep mullionThick panelScale planeAxis panelPrimitive mullionPrimitive material) 1 ->\n    [ Grid(cols rows colStep rowStep planeAxis panelPrimitive material) ]\n    [ FacadeMullions(rows cols rowStep colStep mullionThick planeAxis mullionPrimitive material) ]",
                    ],
                    [
                        'name' => 'VaultedRingGrid',
                        'description' => 'A ring or grid field with an arch lift or vault deformation.',
                        'parameters' => ['span:float', 'archHeight:float', 'N:int', 'axis:int', 'mode:symbol', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['halls', 'canopies', 'arched roofs', 'vaulted pavilions'],
                        'pseudocode' => "VaultedRingGrid(span archHeight N axis mode primitive material) 1 ->\n    ?(mode==ring) VaultedRing(span archHeight N axis primitive material) : VaultedGrid(span archHeight N axis primitive material)",
                    ],
                    [
                        'name' => 'RadialCanopy',
                        'description' => 'Spokes and rings bent upward toward a canopy profile.',
                        'parameters' => ['spokes:int', 'rings:int', 'radius:float', 'ringStep:float', 'curvature:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['umbrella forms', 'pavilions', 'roof canopies', 'radial shelters'],
                        'pseudocode' => "RadialCanopy(spokes rings radius ringStep curvature axis primitive material) 1 ->\n    CanopyRing(0 rings spokes radius ringStep curvature axis primitive material)\n\nCanopyRing(i rings spokes radius ringStep curvature axis primitive material) ?(i < int(rings)) ->\n    [\n        t F(i rings) InvLerp(i,rings)\n        lift F(t curvature) curvature*t*t\n        TranslateAlongAxis(axis, lift)\n        Ring(spokes radius*(t+1/rings) axis 1 primitive material)\n    ]\n    CanopyRing(i+1 rings spokes radius ringStep curvature axis primitive material)",
                    ],
                ],
            ],
            [
                'title' => 'Fractal and recursive motifs',
                'intro' => 'These motifs add repetition across depth, ornament, and growth patterns. They should always be bounded by depth and scale damping.',
                'motifs' => [
                    [
                        'name' => 'RecursiveRing',
                        'description' => 'A ring in which each element emits a smaller child ring.',
                        'parameters' => ['depth:int', 'N:int', 'R:float', 'childScale:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['filigree', 'ornaments', 'recursive frames', 'decorative lattices'],
                        'pseudocode' => "RecursiveRing(depth N R childScale axis primitive material) 1 ->\n    RecursiveRingNode(depth N R childScale axis primitive material)\n\nRecursiveRingNode(depth N R childScale axis primitive material) 1 ->\n    [ Ring(N R axis 1 primitive material) ]\n    ?(depth > 0) RecursiveRingChildren(0 depth N R childScale axis primitive material)\n\nRecursiveRingChildren(i depth N R childScale axis primitive material) ?(i < int(N)) ->\n    [\n        RotateAroundAxis(axis, 360*i/N)\n        TranslateRadial(axis, R)\n        S(childScale childScale childScale)\n        RecursiveRingNode(depth-1 N R*childScale childScale axis primitive material)\n    ]\n    RecursiveRingChildren(i+1 depth N R childScale axis primitive material)",
                    ],
                    [
                        'name' => 'L-system Hybrid',
                        'description' => 'An L-system path mapped to repeated ProGen3D instances.',
                        'parameters' => ['axiom:string', 'rules:symbol', 'iterations:int', 'segScale:float', 'turnAngle:float', 'axis:int', 'primitive:symbol', 'material:symbol'],
                        'uses' => ['botanical structures', 'branching ornament', 'recursive skeletal systems', 'procedural vines'],
                        'pseudocode' => "LSystemHybrid(axiom rules iterations segScale turnAngle axis primitive material) 1 ->\n    seq F(axiom rules iterations) ExpandLSystem(axiom,rules,iterations)\n    InterpretLSystem(seq segScale turnAngle axis primitive material)",
                    ],
                ],
            ],
            [
                'title' => 'Symmetry, modulation, and composition',
                'intro' => 'These controls adapt any motif family and are especially useful when composing architectural systems from smaller parts.',
                'motifs' => [
                    [
                        'name' => 'Mirror / Dihedral controls',
                        'description' => 'Attach symmetry logic to any motif to create bilateral, radial, or paired-lobe structure without rewriting the base rule.',
                        'parameters' => ['mirrorX:int', 'mirrorY:int', 'mirrorZ:int', 'lobes:int', 'axis:int'],
                        'uses' => ['paired canopies', 'bilateral frames', 'dihedral lobes', 'symmetry studies'],
                        'pseudocode' => "MirrorX(rule) -> [ Mx ] rule\nMirrorY(rule) -> [ My ] rule\nMirrorZ(rule) -> [ Mz ] rule\n\nDihedral(rule axis lobes) ->\n    DihedralIter(0 lobes rule axis)\n\nDihedralIter(i lobes rule axis) ?(i < int(lobes)) ->\n    [ RotateAroundAxis(axis, 360*i/lobes) rule ]\n    [ RotateAroundAxis(axis, 360*i/lobes + 180/lobes) MirrorPerpToAxis(axis) rule ]\n    DihedralIter(i+1 lobes rule axis)",
                    ],
                    [
                        'name' => 'Example compositions',
                        'description' => 'Use one foundational motif as the primary structure, then layer one or two supporting motifs for system-level results.',
                        'parameters' => ['primaryArchetype:symbol', 'secondaryArchetype:symbol', 'axis:int', 'taper:float', 'twist:float'],
                        'uses' => ['tower pavilion', 'bridge', 'stadium', 'hybrid systems'],
                        'pseudocode' => "TowerPavilion(axis) 1 ->\n    [ Stack(12 1.2 axis 0.92 4 Column stone) ]\n    [ TranslateAlongAxis(axis, 14.4) RingStack(4 18 4.0 0.7 axis 0.94 Beam brushedAluminum) ]\n    [ TranslateAlongAxis(axis, 14.4) RadialCanopy(12 4 3.8 0.6 2.0 axis Rib clearGlass) ]\n\nBridge(axis) 1 ->\n    [ Band(24 18 axis 1 Deck smoothConcrete) ]\n    [ VaultedRingGrid(18 4 14 axis ring Arch shinySteel) ]\n    [ Grid(18 4 1.0 1.2 2 Truss brushedAluminum) ]",
                    ],
                ],
            ],
        ],
    ];
}

function site_ai_reference_text(): string
{
    $parts = [];

    foreach (site_reference_sections() as $section) {
        $parts[] = 'REFERENCE SECTION: ' . (string) ($section['title'] ?? 'Untitled');
        $intro = trim((string) ($section['intro'] ?? ''));
        if ($intro !== '') {
            $parts[] = $intro;
        }

        foreach (($section['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $syntax = trim((string) ($item['syntax'] ?? ''));
            $meaning = trim((string) ($item['meaning'] ?? ''));
            if ($syntax === '' && $meaning === '') {
                continue;
            }
            $parts[] = '- ' . $syntax . ': ' . $meaning;
        }
    }

    foreach (site_docs_sections() as $section) {
        $parts[] = 'WORKFLOW SECTION: ' . (string) ($section['title'] ?? 'Untitled');
        foreach (($section['body'] ?? []) as $body) {
            $text = trim((string) $body);
            if ($text !== '') {
                $parts[] = $text;
            }
        }
        foreach (($section['bullets'] ?? []) as $bullet) {
            $text = trim((string) $bullet);
            if ($text !== '') {
                $parts[] = '- ' . $text;
            }
        }
    }

    $archetypes = site_archetype_reference();
    $overview = is_array($archetypes['overview'] ?? null) ? $archetypes['overview'] : [];
    $parts[] = 'ARCHETYPE OVERVIEW: ' . trim((string) ($overview['title'] ?? 'Structural archetypes'));
    $overviewIntro = trim((string) ($overview['intro'] ?? ''));
    if ($overviewIntro !== '') {
        $parts[] = $overviewIntro;
    }
    foreach (($overview['conventions'] ?? []) as $convention) {
        $text = trim((string) $convention);
        if ($text !== '') {
            $parts[] = '- ' . $text;
        }
    }

    foreach (($archetypes['categories'] ?? []) as $category) {
        if (!is_array($category)) {
            continue;
        }
        $parts[] = 'ARCHETYPE CATEGORY: ' . trim((string) ($category['title'] ?? 'Untitled'));
        $categoryIntro = trim((string) ($category['intro'] ?? ''));
        if ($categoryIntro !== '') {
            $parts[] = $categoryIntro;
        }

        foreach (($category['motifs'] ?? []) as $motif) {
            if (!is_array($motif)) {
                continue;
            }
            $name = trim((string) ($motif['name'] ?? 'Motif'));
            $description = trim((string) ($motif['description'] ?? ''));
            $uses = array_values(array_filter(array_map('trim', $motif['uses'] ?? []), static fn(string $item): bool => $item !== ''));
            $parts[] = '* ' . $name . ': ' . $description;
            if ($uses !== []) {
                $parts[] = '  Uses: ' . implode(', ', $uses);
            }
        }
    }

    foreach (site_examples() as $example) {
        if (!is_array($example)) {
            continue;
        }
        $parts[] = 'EXAMPLE: ' . trim((string) ($example['title'] ?? 'Untitled example'));
        $summary = trim((string) ($example['summary'] ?? ''));
        if ($summary !== '') {
            $parts[] = $summary;
        }
        $grammar = trim((string) ($example['grammar'] ?? ''));
        if ($grammar !== '') {
            $parts[] = $grammar;
        }
    }

    return trim(implode("\n", array_values(array_filter($parts, static fn(string $item): bool => trim($item) !== ''))));
}
