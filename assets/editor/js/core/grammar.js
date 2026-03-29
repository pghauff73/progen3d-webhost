//------------------------------------------------
// grammar.js
// Progen3D grammar parser + runtime + debugger
//------------------------------------------------

if (typeof globalThis !== "undefined") {
    globalThis.PG3D_GRAMMAR_VERSION = "20260315-random-vars";
}

function pg3dEmitParseConsole(kind, message, meta) {
    try {
        if (typeof globalThis !== "undefined" && typeof globalThis.PG3D_LOG === "function") {
            globalThis.PG3D_LOG(kind, message, meta);
            return;
        }
    } catch (_) {}
    try {
        const fn = kind === "error" ? console.error : (kind === "warn" ? console.warn : console.log);
        fn.call(console, message, meta || "");
    } catch (_) {}
}

function pg3dExtractLineColFromMessage(message) {
    const text = String(message || "");
    const match = text.match(/@(\d+):(\d+)/);
    if (!match) return null;
    return {
        line: Number(match[1]),
        col: Number(match[2])
    };
}

function pg3dLineSnippet(text, line) {
    const lines = String(text || "").split(/\r\n|\r|\n/);
    return lines[Math.max(0, (Number(line) || 1) - 1)] || "";
}

// Parser-local token type renamed to avoid collision with lexer-token.js
class GrammarToken {
    constructor(type, value, pos = 0, line = 1, col = 1, endPos = pos) {
        this.type = type;
        this.value = value;
        this.pos = pos;
        this.line = line;
        this.col = col;
        this.endPos = endPos;
    }
}

class GrammarTokenizer {
    constructor(text, options = {}) {
        this.text = text || "";
        this.pos = 0;
        this.line = 1;
        this.col = 1;

        this.emitWhitespace = options.emitWhitespace !== false;
        this.emitNewlines = options.emitNewlines !== false;
        this.debugEnabled = !!options.debug;

        // Full token stream for editor/highlighting
        this.tokens = [];
        // Parser-visible stream excluding ws/nl/comments
        this.parserTokens = [];
        this.stream = this.parserTokens;

        this.index = 0;
        this.tokenDebugLog = [];

        this.tokenize();
        this.parserTokens = this.normalizeParserTokens(this.parserTokens);
        this.stream = this.parserTokens;
    }

    logDebug(type, payload = {}) {
        if (!this.debugEnabled) return;
        this.tokenDebugLog.push({
            type,
            pos: this.pos,
            line: this.line,
            col: this.col,
            ...payload
        });
    }

    advance(count = 1) {
        for (let i = 0; i < count; i++) {
            const ch = this.text[this.pos];
            if (ch === "\n") {
                this.pos++;
                this.line++;
                this.col = 1;
            } else {
                this.pos++;
                this.col++;
            }
        }
    }

    pushToken(type, value, startPos, startLine, startCol, endPos, includeInParse = true) {
        const tok = new GrammarToken(type, value, startPos, startLine, startCol, endPos);
        this.tokens.push(tok);
        if (includeInParse) this.parserTokens.push(tok);
        this.logDebug("token", {
            tokenType: type,
            tokenValue: value,
            startPos,
            startLine,
            startCol,
            endPos,
            includeInParse
        });
        return tok;
    }

    tokenize() {
        const s = this.text;
        const n = s.length;

        while (this.pos < n) {
            const c = s[this.pos];
            const startPos = this.pos;
            const startLine = this.line;
            const startCol = this.col;

            if (c === "\n") {
                if (this.emitNewlines) {
                    this.pushToken("nl", "\n", startPos, startLine, startCol, startPos + 1, false);
                }
                this.advance(1);
                continue;
            }

            if (c === "\r") {
                if (s[this.pos + 1] === "\n") {
                    if (this.emitNewlines) {
                        this.pushToken("nl", "\r\n", startPos, startLine, startCol, startPos + 2, false);
                    }
                    this.advance(2);
                } else {
                    if (this.emitNewlines) {
                        this.pushToken("nl", "\r", startPos, startLine, startCol, startPos + 1, false);
                    }
                    this.advance(1);
                }
                continue;
            }

            if (c === " " || c === "\t") {
                let raw = "";
                while (this.pos < n) {
                    const ch = s[this.pos];
                    if (ch === " " || ch === "\t") {
                        raw += ch;
                        this.advance(1);
                    } else {
                        break;
                    }
                }
                if (this.emitWhitespace) {
                    this.pushToken("ws", raw, startPos, startLine, startCol, this.pos, false);
                }
                continue;
            }

            if (/\s/.test(c)) {
                let raw = "";
                while (this.pos < n) {
                    const ch = s[this.pos];
                    if (ch !== "\n" && ch !== "\r" && /\s/.test(ch)) {
                        raw += ch;
                        this.advance(1);
                    } else {
                        break;
                    }
                }
                if (this.emitWhitespace && raw.length > 0) {
                    this.pushToken("ws", raw, startPos, startLine, startCol, this.pos, false);
                }
                continue;
            }

            if (c === "/" && s[this.pos + 1] === "/") {
                let raw = "";
                while (this.pos < n && s[this.pos] !== "\n" && s[this.pos] !== "\r") {
                    raw += s[this.pos];
                    this.advance(1);
                }
                this.pushToken("comment_line", raw, startPos, startLine, startCol, this.pos, false);
                continue;
            }

            if (c === "/" && s[this.pos + 1] === "*") {
                this.advance(2);
                let raw = "/*";
                while (this.pos < n && !(s[this.pos] === "*" && s[this.pos + 1] === "/")) {
                    raw += s[this.pos];
                    this.advance(1);
                }
                if (this.pos >= n) {
                    throw new Error(`Unterminated block comment at ${startPos} (line ${startLine}, col ${startCol})`);
                }
                raw += "*/";
                this.advance(2);
                this.pushToken("comment_block", raw, startPos, startLine, startCol, this.pos, false);
                continue;
            }

            if (/[A-Za-z_]/.test(c)) {
                this.advance(1);
                while (this.pos < n && /[A-Za-z0-9_]/.test(s[this.pos])) this.advance(1);
                const id = s.slice(startPos, this.pos);
                this.pushToken("id", id, startPos, startLine, startCol, this.pos, true);
                continue;
            }

            if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[this.pos + 1] || ""))) {
                let sawDot = false;

                if (c === ".") {
                    sawDot = true;
                    this.advance(1);
                } else {
                    this.advance(1);
                }

                while (this.pos < n) {
                    const ch = s[this.pos];
                    if (/[0-9]/.test(ch)) {
                        this.advance(1);
                        continue;
                    }
                    if (ch === "." && !sawDot) {
                        sawDot = true;
                        this.advance(1);
                        continue;
                    }
                    break;
                }

                const raw = s.slice(startPos, this.pos);
                const value = Number(raw);
                if (!Number.isFinite(value)) {
                    throw new Error(`Invalid number '${raw}' at ${startPos} (line ${startLine}, col ${startCol})`);
                }
                this.pushToken("num", value, startPos, startLine, startCol, this.pos, true);
                continue;
            }

            const two = s.slice(this.pos, this.pos + 2);

            if (["<=", ">=", "==", "!=", "->"].includes(two)) {
                this.pushToken(two, two, startPos, startLine, startCol, this.pos + 2, true);
                this.advance(2);
                continue;
            }

            if ("+-*/^()[]<>,:?|;".includes(c)) {
                this.pushToken(c, c, startPos, startLine, startCol, this.pos + 1, true);
                this.advance(1);
                continue;
            }

            throw new Error(`Unknown character '${c}' at ${this.pos} (line ${this.line}, col ${this.col})`);
        }

        this.pushToken("eof", "eof", this.pos, this.line, this.col, this.pos, true);

        this.logDebug("summary", {
            totalTokens: this.tokens.length,
            parseTokens: this.parserTokens.length,
            wsTokens: this.tokens.filter(t => t.type === "ws").length,
            nlTokens: this.tokens.filter(t => t.type === "nl").length,
            commentTokens: this.tokens.filter(t => t.type === "comment_line" || t.type === "comment_block").length
        });
    }

    normalizeParserTokens(tokens) {
        const out = [];

        for (let i = 0; i < tokens.length; i++) {
            const t0 = tokens[i];
            const t1 = tokens[i + 1];
            const t2 = tokens[i + 2];
            const t3 = tokens[i + 3];
            const t4 = tokens[i + 4];
            const t5 = tokens[i + 5];
            const t6 = tokens[i + 6];
            const t7 = tokens[i + 7];

            out.push(t0);

            if (
                t0 && t0.type === "*" &&
                t1 && (t1.type === "id" || t1.type === "num") &&
                t2 && (t2.type === "+" || t2.type === "-") &&
                t3 && (t3.type === "id" || t3.type === "num") &&
                t4 && t4.type === ")" &&
                t5 && t5.type === "/" &&
                t6 && (t6.type === "id" || t6.type === "num") &&
                t7 && t7.type === ")"
            ) {
                out.push(new GrammarToken("(", "(", t0.endPos, t0.line, t0.col + String(t0.value).length, t0.endPos));
            }
        }

        return out;
    }

    peek(offset = 0) {
        let cursor = this.index;
        let remaining = offset;

        while (cursor < this.stream.length) {
            const tok = this.stream[cursor];
            if (!this.isSkippableParseToken(tok)) {
                if (remaining === 0) return tok;
                remaining--;
            }
            cursor++;
        }

        return this.stream[this.stream.length - 1] || null;
    }

    next() {
        while (this.index < this.stream.length) {
            const tok = this.stream[this.index++];
            if (!this.isSkippableParseToken(tok)) return tok;
        }
        return this.stream[this.stream.length - 1] || null;
    }

    match(type, value = undefined) {
        const t = this.peek();
        if (!t) return false;
        if (t.type !== type) return false;
        if (value !== undefined && t.value !== value) return false;
        this.index++;
        return true;
    }

    expect(type, value = undefined, message = "") {
        const t = this.next();
        if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
            const got = t ? `${t.type}:${t.value} @${t.line}:${t.col}` : "EOF";
            const want = value !== undefined ? `${type}:${value}` : type;
            throw new Error(message || `Expected ${want}, got ${got}`);
        }
        return t;
    }

    expectId(message = "Expected identifier") {
        const t = this.expect("id", undefined, message);
        return t.value;
    }

    eof() {
        const t = this.peek();
        return !!t && t.type === "eof";
    }

    reset() {
        this.index = 0;
        return this;
    }

    isSkippableParseToken(t) {
        if (!t) return false;
        return t.type === "ws" || t.type === "nl" || t.type === "comment_line" || t.type === "comment_block";
    }

    getAllTokens() {
        return [...this.tokens];
    }

    getParseTokens() {
        return [...this.parserTokens];
    }

    getDebugInfo() {
        return {
            totalTokens: this.tokens.length,
            parseTokens: this.parserTokens.length,
            visualTokens: this.tokens.filter(t => t.type === "ws" || t.type === "nl").length,
            commentTokens: this.tokens.filter(t => t.type === "comment_line" || t.type === "comment_block").length,
            debugLog: [...this.tokenDebugLog]
        };
    }
}

class ExpressionParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.stopAtSpacedUnaryBoundary = false;
        this.parenDepth = 0;
        this.boundaryParenDepth = 0;
        this.builtinFunctionNames = new Set(["sin", "cos", "tan", "abs", "sqrt", "floor", "ceil", "min", "max", "float", "int", "rand"]);
    }

    withSpacedUnaryBoundary(enabled, fn) {
        const previous = this.stopAtSpacedUnaryBoundary;
        const previousBoundaryDepth = this.boundaryParenDepth;
        this.stopAtSpacedUnaryBoundary = !!enabled;
        if (enabled) this.boundaryParenDepth = this.parenDepth;
        try {
            return fn();
        } finally {
            this.stopAtSpacedUnaryBoundary = previous;
            this.boundaryParenDepth = previousBoundaryDepth;
        }
    }

    parseExpression(options = undefined) {
        if (options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "stopAtSpacedUnaryBoundary")) {
            return this.withSpacedUnaryBoundary(options.stopAtSpacedUnaryBoundary, () => this.parseComparison());
        }
        return this.parseComparison();
    }

    parseExpressionList(closeType = ")") {
        const args = [];
        if (this.tokens.match(closeType)) return args;

        while (true) {
            args.push(this.parseExpression());
            if (this.tokens.match(closeType)) break;
            if (this.tokens.match(",")) continue;
            if (this.isExpressionStart(this.tokens.peek())) continue;
            const t = this.tokens.peek();
            const got = t ? `${t.type}:${t.value}` : "EOF";
            throw new Error(`Expected "," or ${closeType} in argument list, got ${got}`);
        }

        return args;
    }

    isExpressionStart(t) {
        if (!t) return false;
        return t.type === "num" || t.type === "id" || t.type === "(" || t.type === "-";
    }

    parseComparison() {
        let left = this.parseAdd();

        while (true) {
            const t = this.tokens.peek();
            if (!t) break;

            if (["<", ">", "<=", ">=", "==", "!="].includes(t.type)) {
                this.tokens.next();
                const right = this.parseAdd();
                left = {
                    type: "compare",
                    op: t.type,
                    left,
                    right
                };
                continue;
            }
            break;
        }

        return left;
    }

    parseAdd() {
        let left = this.parseMul();

        while (true) {
            const t = this.tokens.peek();
            if (!t) break;

            if (t.type === "+" || t.type === "-") {
                if (this.stopAtSpacedUnaryBoundary && t.type === "-" && this.isSpacedUnaryBoundary()) {
                    break;
                }
                this.tokens.next();
                const right = this.parseMul();
                left = {
                    type: "bin",
                    op: t.type,
                    left,
                    right
                };
                continue;
            }
            break;
        }

        return left;
    }

    isSpacedUnaryBoundary() {
        const current = this.tokens.peek();
        const next = this.tokens.peek(1);
        const previous = this.tokens.stream && this.tokens.index > 0 ? this.tokens.stream[this.tokens.index - 1] : null;
        if (!current || !next || !previous) return false;
        if (current.type !== "-") return false;
        if (!this.isExpressionStart(next)) return false;
        if (this.parenDepth !== this.boundaryParenDepth) return false;
        return current.pos > previous.endPos;
    }

    hasWhitespaceGapBetween(a, b) {
        if (!a || !b) return false;
        return Number(b.pos) > Number(a.endPos);
    }

    parseMul() {
        let left = this.parsePow();

        while (true) {
            const t = this.tokens.peek();
            if (!t) break;

            if (t.type === "*" || t.type === "/") {
                this.tokens.next();
                const right = this.parsePow();
                left = {
                    type: "bin",
                    op: t.type,
                    left,
                    right
                };
                continue;
            }
            break;
        }

        return left;
    }

    parsePow() {
        let left = this.parseUnary();

        const t = this.tokens.peek();
        if (t && t.type === "^") {
            this.tokens.next();
            const right = this.parsePow();
            left = {
                type: "bin",
                op: "^",
                left,
                right
            };
        }

        return left;
    }

    parseUnary() {
        const t = this.tokens.peek();
        if (t && t.type === "-") {
            this.tokens.next();
            return {
                type: "neg",
                value: this.parseUnary()
            };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        this.skipRedundantClosingParensBeforeExpressionStart();
        const t = this.tokens.peek();

        if (!t) {
            throw new Error("Unexpected end of expression");
        }

        if (t.type === "num") {
            this.tokens.next();
            return { type: "num", value: t.value };
        }

        if (t.type === "id") {
            const nameTok = this.tokens.next();
            const name = nameTok.value;
            const nextTok = this.tokens.peek();
            const hasSpacedParen = nextTok && nextTok.type === "(" && this.hasWhitespaceGapBetween(nameTok, nextTok);
            const allowCall = nextTok && nextTok.type === "(" && (
                !this.stopAtSpacedUnaryBoundary ||
                this.builtinFunctionNames.has(name)
            );

            if (allowCall) {
                this.tokens.match("(");
                const args = this.parseExpressionList(")");

                if (this.builtinFunctionNames.has(name)) {
                    return {
                        type: "func",
                        name,
                        args
                    };
                }

                return {
                    type: "call_expr",
                    name,
                    args
                };
            }

            return { type: "var", name };
        }

        if (this.tokens.match("(")) {
            this.parenDepth += 1;
            try {
                const e = this.parseExpression();
                this.tokens.expect(")");
                return e;
            } finally {
                this.parenDepth = Math.max(0, this.parenDepth - 1);
            }
        }

        throw new Error(`Bad expression near ${t.type}:${t.value} @${t.line}:${t.col}`);
    }

    skipRedundantClosingParensBeforeExpressionStart() {
        while (true) {
            const current = this.tokens.peek();
            const next = this.tokens.peek(1);
            if (!current || current.type !== ")" || !this.isExpressionStart(next)) return;
            this.tokens.next();
        }
    }
}

class GrammarParser {
    constructor(text, options = {}) {
        this.options = options || {};
        this.grammarTokenizer = new GrammarTokenizer(text, {
            emitWhitespace: this.options.emitWhitespace !== false,
            emitNewlines: this.options.emitNewlines !== false,
            debug: !!this.options.debug
        });
        this.tokens = this.grammarTokenizer;
        this.expr = new ExpressionParser(this.tokens);
        this.ruleOrder = [];
        this.rules = new Map();
        this.debug = [];
    }

    log(type, payload = {}) {
        if (!this.options.debug) return;
        this.debug.push({ type, ...payload });
    }

    parse() {
        this.log("parse_start", {
            totalTokens: this.tokens.tokens.length,
            parseTokens: this.tokens.parserTokens.length
        });

        while (!this.tokens.eof()) {
            if (this.tokens.peek().type === "eof") break;
            const rule = this.parseRule();
            if (!this.rules.has(rule.name)) {
                this.rules.set(rule.name, []);
                this.ruleOrder.push(rule.name);
            }
            this.rules.get(rule.name).push(rule);
        }

        const result = {
            type: "grammar",
            entry: this.ruleOrder[0] || "Start",
            order: [...this.ruleOrder],
            rules: this.rules,
            debug: {
                parserEvents: [...this.debug],
                lexer: this.tokens.getDebugInfo()
            }
        };

        this.log("parse_done", {
            entry: result.entry,
            ruleCount: this.ruleOrder.length
        });

        return result;
    }

    parseRule() {
        const name = this.tokens.expectId();

        let params = [];
        if (this.tokens.match("(")) {
            params = this.parseIdentifierList(")");
        }

        let repeatExpr = null;
        let probability = null;

        if (this.isExpressionStart(this.tokens.peek())) {
            repeatExpr = this.expr.parseExpression();
        }

        if (this.tokens.match(";")) {
            probability = this.expr.parseExpression();
        }

        this.tokens.expect("->");

        const stages = this.parseRuleStages();

        const rule = {
            type: "rule",
            name,
            params,
            repeatExpr,
            probability,
            stages
        };

        this.log("rule", {
            name,
            params: [...params],
            hasRepeat: !!repeatExpr,
            hasProbability: !!probability,
            preCount: stages.pre.length,
            mainCount: stages.main.length,
            postCount: stages.post.length
        });

        return rule;
    }

    parseRuleStages() {
        const stage0 = this.parseSequence(["|", "eof"]);
        if (!this.tokens.match("|")) {
            return {
                pre: [],
                main: stage0,
                post: []
            };
        }

        const stage1 = this.parseSequence(["|", "eof"]);
        if (!this.tokens.match("|")) {
            return {
                pre: stage0,
                main: stage1,
                post: []
            };
        }

        const stage2 = this.parseSequence(["|", "eof"]);
        return {
            pre: stage0,
            main: stage1,
            post: stage2
        };
    }

    parseSequence(stopTypes = ["]", "|", "eof"]) {
        const list = [];

        while (true) {
            const t = this.tokens.peek();
            if (!t) break;
            if (stopTypes.includes(t.type)) break;
            if (this.isRuleHeaderAhead()) break;

            list.push(this.parseStatement());
        }

        return list;
    }

    isRuleHeaderAhead() {
        return this.isRuleHeaderAheadAt(0);
    }

    isRuleHeaderAheadAt(offset = 0) {
        const first = this.tokens.peek(offset);
        if (!first || first.type !== "id") return false;
        if (!this.isAtLogicalLineStart(offset)) return false;

        let idx = offset + 1;
        let depth = 0;

        while (true) {
            const t = this.tokens.peek(idx);
            if (!t) return false;
            if (t.type === "eof") return false;
            if (t.line > first.line) return false;

            if (t.type === "(") {
                depth += 1;
                idx += 1;
                continue;
            }

            if (t.type === ")") {
                if (depth === 0) return false;
                depth -= 1;
                idx += 1;
                continue;
            }

            if (depth > 0) {
                idx += 1;
                continue;
            }

            if (t.type === "->") return true;
            if (t.type === "[" || t.type === "]" || t.type === "|" || t.type === "?" || t.type === ":") return false;

            idx += 1;
        }
    }

    isAtLogicalLineStart(offset = 0) {
        const absoluteIndex = this.tokens.index + offset;
        if (absoluteIndex <= 0) return true;
        const parseTokens = this.tokens.getParseTokens();
        const prev = parseTokens[absoluteIndex - 1] || null;
        const current = this.tokens.peek(offset);
        if (!current) return false;
        if (!prev) return true;
        return current.line > prev.line;
    }

    parseStatement() {
        const t = this.tokens.peek();

        if (t.type === "[") return this.parseGroup();
        if (t.type === "?") return this.parseConditional();

        if (t.type === "id") {
            const v = t.value;
            if (v === "R" && (this.tokens.peek(1)?.type === "*" || this.tokens.peek(1)?.type === "id")) {
                return this.parseRandomVariable();
            }
            if (["T", "S", "A", "R", "DSX", "DSY", "DSZ", "DTX", "DTY", "DTZ", "GDSX", "GDSY", "GDSZ", "GDTX", "GDTY", "GDTZ"].includes(v)) {
                return this.parseTransformLike();
            }
            if (v === "I") {
                return this.parseInstance();
            }
            return this.parseRuleCallOrVariable();
        }

        throw new Error(`Unexpected token in statement: ${t.type}:${t.value} @${t.line}:${t.col}`);
    }

    parseRandomVariable() {
        const opTok = this.tokens.expect("id");
        let integer = false;

        if (this.tokens.match("*")) {
            integer = true;
        }

        const name = this.tokens.expectId("Expected variable name after R");
        if (!this.tokens.peek() || this.tokens.peek().type !== "(") {
            return {
                type: "reroll_variable",
                name,
                pos: opTok.pos,
                line: opTok.line,
                col: opTok.col
            };
        }
        this.tokens.expect("(", undefined, `Expected "(" after random variable ${name}`);
        const minExpr = this.expr.parseExpression();
        const maxExpr = this.expr.parseExpression();
        this.tokens.expect(")");

        return {
            type: "random_variable",
            name,
            minExpr,
            maxExpr,
            integer,
            pos: opTok.pos,
            line: opTok.line,
            col: opTok.col
        };
    }

    parseGroup() {
        this.tokens.expect("[");
        const seq = this.parseSequence(["]"]);
        this.tokens.expect("]");
        return {
            type: "group",
            seq
        };
    }

    parseConditional() {
        this.tokens.expect("?");
        this.tokens.expect("(");
        const cond = this.expr.parseExpression();
        this.tokens.expect(")");

        if (this.hasConditionalBranchSeparatorAhead()) {
            const branchMain = this.parseSequence([":", "]", "|", "eof"]);
            this.tokens.expect(":");
            const branchAlt = this.parseSequence(["]", "|", "eof"]);
            return {
                type: "conditional",
                cond,
                branchMain,
                branchAlt
            };
        }

        const ruleMain = this.parseRuleCall();
        return {
            type: "conditional",
            cond,
            ruleMain,
            ruleAlt: null,
            branchMain: null,
            branchAlt: null
        };
    }

    hasConditionalBranchSeparatorAhead() {
        let idx = 0;
        let parenDepth = 0;
        let bracketDepth = 0;

        while (true) {
            const t = this.tokens.peek(idx);
            if (!t || t.type === "eof") return false;

            if (parenDepth === 0 && bracketDepth === 0) {
                if (t.type === ":") return true;
                if (t.type === "|" || t.type === "]") return false;
                if (idx > 0 && this.isRuleHeaderAheadAt(idx)) return false;
            }

            if (t.type === "(") {
                parenDepth += 1;
            } else if (t.type === ")") {
                if (parenDepth > 0) parenDepth -= 1;
            } else if (t.type === "[") {
                bracketDepth += 1;
            } else if (t.type === "]") {
                if (bracketDepth === 0) return false;
                bracketDepth -= 1;
            }

            idx += 1;
        }
    }

    parseRuleCall() {
        const name = this.tokens.expectId();
        const args = [];

        if (this.tokens.match("(")) {
            args.push(...this.expr.parseExpressionList(")"));
        }

        return {
            type: "rule_call",
            name,
            args
        };
    }

    parseRuleCallOrVariable() {
        const nameToken = this.tokens.peek();
        const name = this.tokens.expectId();

        if (this.tokens.match("(")) {
            const args = this.expr.parseExpressionList(")");

            return {
                type: "rule_call",
                name,
                args,
                pos: nameToken.pos,
                line: nameToken.line,
                col: nameToken.col
            };
        }

        return {
            type: "rule_call",
            name,
            args: [],
            pos: nameToken.pos,
            line: nameToken.line,
            col: nameToken.col
        };
    }

    parseIdentifierList(closeType = ")") {
        const values = [];
        if (this.tokens.match(closeType)) return values;

        while (true) {
            values.push(this.tokens.expectId());
            if (this.tokens.match(closeType)) break;
            if (this.tokens.match(",")) continue;
            const t = this.tokens.peek();
            if (t && t.type === "id") continue;
            const got = t ? `${t.type}:${t.value}` : "EOF";
            throw new Error(`Expected "," or ${closeType} in parameter list, got ${got}`);
        }

        return values;
    }

    expectOperatorCallOpen(op) {
        this.tokens.expect("(", undefined, `Expected "(" after operator ${op}`);
    }

    parseTransformLike() {
        const opTok = this.tokens.expect("id");
        const op = opTok.value;

        this.expectOperatorCallOpen(op);

        if (op === "A" || op === "R") {
            const a = this.expr.parseExpression({ stopAtSpacedUnaryBoundary: true });
            const b = this.expr.parseExpression({ stopAtSpacedUnaryBoundary: true });
            this.tokens.expect(")");
            return {
                type: "transform",
                op,
                args: [a, b],
                pos: opTok.pos,
                line: opTok.line,
                col: opTok.col
            };
        }

        if (["T", "S", "DSX", "DSY", "DSZ", "DTX", "DTY", "DTZ", "GDSX", "GDSY", "GDSZ", "GDTX", "GDTY", "GDTZ"].includes(op)) {
            const x = this.expr.parseExpression({ stopAtSpacedUnaryBoundary: true });
            const y = this.expr.parseExpression({ stopAtSpacedUnaryBoundary: true });
            const z = this.expr.parseExpression({ stopAtSpacedUnaryBoundary: true });
            this.tokens.expect(")");
            return {
                type: "transform",
                op,
                args: [x, y, z],
                pos: opTok.pos,
                line: opTok.line,
                col: opTok.col
            };
        }

        throw new Error(`Unsupported transform operator ${op} @${opTok.line}:${opTok.col}`);
    }

    parseInstance() {
        const tok = this.tokens.expect("id"); // I
        this.tokens.expect("(");
        const primitive = this.tokens.expectId("Expected primitive name");
        const texture = this.tokens.expectId("Expected texture name");
        const scaleExpr = this.expr.parseExpression();
        this.tokens.expect(")");

        return {
            type: "instance",
            primitive,
            texture,
            scaleExpr,
            pos: tok.pos,
            line: tok.line,
            col: tok.col
        };
    }

    isExpressionStart(t) {
        if (!t) return false;
        return t.type === "num" || t.type === "id" || t.type === "(" || t.type === "-";
    }
}

class ExprEval {
    static eval(node, env = {}, runtime = null) {
        if (!node) return 0;

        switch (node.type) {
            case "num":
                return node.value;

            case "var":
                if (node.name === "pi" || node.name === "PI") return Math.PI;
                if (node.name === "e" || node.name === "E") return Math.E;
                return env[node.name] !== undefined ? env[node.name] : 0;

            case "neg":
                return -ExprEval.eval(node.value, env, runtime);

            case "bin": {
                const a = ExprEval.eval(node.left, env, runtime);
                const b = ExprEval.eval(node.right, env, runtime);
                switch (node.op) {
                    case "+": return a + b;
                    case "-": return a - b;
                    case "*": return a * b;
                    case "/": return b === 0 ? 0 : a / b;
                    case "^": return Math.pow(a, b);
                    default: throw new Error(`Unknown binary op ${node.op}`);
                }
            }

            case "compare": {
                const a = ExprEval.eval(node.left, env, runtime);
                const b = ExprEval.eval(node.right, env, runtime);
                switch (node.op) {
                    case "<": return a < b ? 1 : 0;
                    case ">": return a > b ? 1 : 0;
                    case "<=": return a <= b ? 1 : 0;
                    case ">=": return a >= b ? 1 : 0;
                    case "==": return a === b ? 1 : 0;
                    case "!=": return a !== b ? 1 : 0;
                    default: throw new Error(`Unknown compare op ${node.op}`);
                }
            }

            case "func": {
                switch (node.name) {
                    case "rand": {
                        const rng = runtime && runtime.rng && typeof runtime.rng.next === "function"
                            ? runtime.rng
                            : null;
                        const nextRandom = () => (rng ? rng.next() : Math.random());

                        if (node.args.length === 1) {
                            const ref = node.args[0];
                            const refName = ref && (ref.type === "var" || ref.type === "call_expr") ? ref.name : null;
                            const ranges = env && env.__randomRanges ? env.__randomRanges : null;
                            const entry = refName && ranges ? ranges[refName] : null;
                            if (entry) {
                                const min = Number(entry.min);
                                const max = Number(entry.max);
                                let value;
                                if (entry.integer) {
                                    const lo = Math.ceil(min);
                                    const hi = Math.floor(max);
                                    value = hi < lo ? lo : lo + Math.floor(nextRandom() * (hi - lo + 1));
                                } else {
                                    value = min === max ? min : min + (max - min) * nextRandom();
                                }
                                env[refName] = value;
                                return value;
                            }
                        }

                        const vals = node.args.map(a => ExprEval.eval(a, env, runtime));
                        let min = Number(vals[0] || 0);
                        let max = Number(vals[1] != null ? vals[1] : min);
                        if (!Number.isFinite(min)) min = 0;
                        if (!Number.isFinite(max)) max = min;
                        if (min > max) {
                            const swap = min;
                            min = max;
                            max = swap;
                        }
                        return min === max ? min : min + (max - min) * nextRandom();
                    }
                }

                const vals = node.args.map(a => ExprEval.eval(a, env, runtime));
                switch (node.name) {
                    case "sin": return Math.sin(vals[0] || 0);
                    case "cos": return Math.cos(vals[0] || 0);
                    case "tan": return Math.tan(vals[0] || 0);
                    case "abs": return Math.abs(vals[0] || 0);
                    case "sqrt": return Math.sqrt(Math.max(0, vals[0] || 0));
                    case "floor": return Math.floor(vals[0] || 0);
                    case "ceil": return Math.ceil(vals[0] || 0);
                    case "float": return Number(vals[0] || 0);
                    case "int": return Math.trunc(vals[0] || 0);
                    case "min": return Math.min(...vals);
                    case "max": return Math.max(...vals);
                    default: throw new Error(`Unknown function ${node.name}`);
                }
            }

            case "call_expr":
                return env[node.name] !== undefined ? env[node.name] : 0;

            default:
                throw new Error(`Unknown expression node ${node.type}`);
        }
    }
}

class GrammarRNG {
    constructor(seed = 123456789) {
        this.seed = seed >>> 0;
    }

    next() {
        this.seed = (1664525 * this.seed + 1013904223) >>> 0;
        return this.seed / 0x100000000;
    }
}

function makeRuntimeSeed(seed) {
    if (seed != null && Number.isFinite(Number(seed))) {
        return Number(seed) >>> 0;
    }
    return (((Date.now() >>> 0) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0);
}

function makeDefaultState() {
    return {
        T: [0, 0, 0],
        S: [1, 1, 1],
        A: [0, 0, 0],
        M: matIdentity(),
        DSX: [1, 1, 1],
        DSY: [1, 1, 1],
        DSZ: [1, 1, 1],
        DTX: [0, 0, 0],
        DTY: [0, 0, 0],
        DTZ: [0, 0, 0],
        GDSX: [1, 1, 1],
        GDSY: [1, 1, 1],
        GDSZ: [1, 1, 1],
        GDTX: [0, 0, 0],
        GDTY: [0, 0, 0],
        GDTZ: [0, 0, 0],
        GDSCOPE: null
    };
}

function cloneState(s) {
    return {
        T: [...s.T],
        S: [...s.S],
        A: [...s.A],
        M: matClone(s.M),
        DSX: [...s.DSX],
        DSY: [...s.DSY],
        DSZ: [...s.DSZ],
        DTX: [...s.DTX],
        DTY: [...s.DTY],
        DTZ: [...s.DTZ],
        GDSX: [...s.GDSX],
        GDSY: [...s.GDSY],
        GDSZ: [...s.GDSZ],
        GDTX: [...s.GDTX],
        GDTY: [...s.GDTY],
        GDTZ: [...s.GDTZ],
        GDSCOPE: s.GDSCOPE
    };
}

function globalAxisDeformIsActive(state) {
    if (!state) return false;
    const isIdentityScale = (v) => Array.isArray(v) && v[0] === 1 && v[1] === 1 && v[2] === 1;
    const isIdentityTranslate = (v) => Array.isArray(v) && v[0] === 0 && v[1] === 0 && v[2] === 0;
    return !(
        isIdentityScale(state.GDSX) &&
        isIdentityScale(state.GDSY) &&
        isIdentityScale(state.GDSZ) &&
        isIdentityTranslate(state.GDTX) &&
        isIdentityTranslate(state.GDTY) &&
        isIdentityTranslate(state.GDTZ)
    );
}

function matIdentity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function matClone(m) {
    if (!m) return matIdentity();
    return new Float32Array(m);
}

function matMultiply(a, b) {
    const c = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        const bi = col * 4;
        const b0 = b[bi + 0], b1 = b[bi + 1], b2 = b[bi + 2], b3 = b[bi + 3];
        c[bi + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        c[bi + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        c[bi + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        c[bi + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return c;
}

function matTranslation(tx, ty, tz) {
    const m = matIdentity();
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    return m;
}

function matScale(sx, sy, sz) {
    const m = matIdentity();
    m[0] = sx;
    m[5] = sy;
    m[10] = sz;
    return m;
}

function matRotX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function matRotY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function matRotZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function syncLegacyChannelsFromMatrix(state) {
    const matrix = state.M || matIdentity();
    state.T[0] = matrix[12];
    state.T[1] = matrix[13];
    state.T[2] = matrix[14];
}

function primitiveForwardStep(primitive) {
    if (primitive === "CubeX") return [1, 0, 0];
    if (primitive === "CubeY") return [0, 1, 0];
    if (primitive === "CubeZ") return [0, 0, 1];
    return null;
}

const DEBUG_EVENT = {
    RULE_ENTER: "rule_enter",
    RULE_EXIT: "rule_exit",
    STAGE_ENTER: "stage_enter",
    STAGE_EXIT: "stage_exit",
    STATEMENT: "statement",
    INSTANCE: "instance",
    CONDITIONAL: "conditional",
    CALL: "call",
    TRANSFORM: "transform",
    GROUP_ENTER: "group_enter",
    GROUP_EXIT: "group_exit"
};

class GrammarRuntime {
    constructor(grammar, options = {}) {
        this.grammar = grammar;
        this.entry = options.entry || grammar.entry || "Start";
        this.maxSteps = options.maxSteps || 100000;
        this.rng = new GrammarRNG(makeRuntimeSeed(options.seed));
        this.emittedItems = [];
        this.debug = [];
        this.stepCount = 0;
        this.finished = false;
        this.globalDeformScopeCounter = 1;

        this.callStack = [{
            kind: "rule_frame",
            ruleName: this.entry,
            env: {},
            state: makeDefaultState(),
            phase: "enter"
        }];
    }

    log(type, payload = {}) {
        const evt = {
            step: this.stepCount,
            type,
            ...payload
        };
        this.debug.push(evt);
        return evt;
    }

    getRuleAlternatives(name) {
        return this.grammar.rules.get(name) || [];
    }

    chooseRuleVariant(name, env) {
        const alts = this.getRuleAlternatives(name);
        if (!alts.length) {
            throw new Error(`Rule not found: ${name}`);
        }

        if (alts.length === 1) return alts[0];

        let total = 0;
        const weighted = alts.map(r => {
            const w = r.probability ? Math.max(0, Number(ExprEval.eval(r.probability, env, this))) : 1;
            total += w;
            return { rule: r, weight: w };
        });

        if (total <= 0) return alts[0];

        let pick = this.rng.next() * total;
        for (const item of weighted) {
            pick -= item.weight;
            if (pick <= 0) return item.rule;
        }

        return weighted[weighted.length - 1].rule;
    }

    invokeRule(name, args, parentEnv, currentState) {
        const env = Object.create(parentEnv || null);
        env.__randomRanges = Object.create((parentEnv && parentEnv.__randomRanges) || null);
        const variant = this.chooseRuleVariant(name, env);

        for (let i = 0; i < variant.params.length; i++) {
            env[variant.params[i]] = args[i] !== undefined ? args[i] : 0;
        }

        let repeat = 1;
        if (variant.repeatExpr) {
            repeat = Math.max(0, Math.floor(ExprEval.eval(variant.repeatExpr, env, this)));
        }

        if (env.repeatIndex === undefined) env.repeatIndex = 0;
        if (env.ri === undefined) env.ri = 0;

        this.callStack.push({
            kind: "rule_exec",
            rule: variant,
            ruleName: name,
            env,
            state: cloneState(currentState),
            repeat,
            repeatIndex: 0,
            phase: "enter"
        });
    }

    step() {
        if (this.finished) {
            return { done: true, event: null };
        }

        if (this.stepCount++ > this.maxSteps) {
            throw new Error(`Max step limit exceeded (${this.maxSteps})`);
        }

        while (this.callStack.length) {
            const frame = this.callStack[this.callStack.length - 1];

            if (frame.kind === "rule_frame") {
                this.callStack.pop();
                this.invokeRule(frame.ruleName, [], frame.env || {}, frame.state);
                continue;
            }

            if (frame.kind === "rule_exec") {
                if (frame.phase === "enter") {
                    frame.phase = "repeat_check";
                    return {
                        done: false,
                        event: this.log(DEBUG_EVENT.RULE_ENTER, {
                            rule: frame.rule.name,
                            env: snapshotEnv(frame.env),
                            repeat: frame.repeat
                        })
                    };
                }

                if (frame.phase === "repeat_check") {
                    if (frame.repeatIndex >= frame.repeat) {
                        this.callStack.pop();
                        return {
                            done: false,
                            event: this.log(DEBUG_EVENT.RULE_EXIT, {
                                rule: frame.rule.name
                            })
                        };
                    }

                    frame.env.repeatIndex = frame.repeatIndex;
                    frame.env.ri = frame.repeatIndex;
                    frame.phase = "pre_stage";
                    continue;
                }

                if (frame.phase === "pre_stage") {
                    frame.phase = "main_stage";
                    this.callStack.push(makeStageFrame("pre", frame.rule.stages.pre, frame.env, frame.state));
                    return {
                        done: false,
                        event: this.log(DEBUG_EVENT.STAGE_ENTER, {
                            rule: frame.rule.name,
                            stage: "pre",
                            repeatIndex: frame.repeatIndex
                        })
                    };
                }

                if (frame.phase === "main_stage") {
                    frame.phase = "post_stage";
                    this.callStack.push(makeStageFrame("main", frame.rule.stages.main, frame.env, frame.state));
                    return {
                        done: false,
                        event: this.log(DEBUG_EVENT.STAGE_ENTER, {
                            rule: frame.rule.name,
                            stage: "main",
                            repeatIndex: frame.repeatIndex
                        })
                    };
                }

                if (frame.phase === "post_stage") {
                    frame.phase = "repeat_done";
                    this.callStack.push(makeStageFrame("post", frame.rule.stages.post, frame.env, frame.state));
                    return {
                        done: false,
                        event: this.log(DEBUG_EVENT.STAGE_ENTER, {
                            rule: frame.rule.name,
                            stage: "post",
                            repeatIndex: frame.repeatIndex
                        })
                    };
                }

                if (frame.phase === "repeat_done") {
                    frame.repeatIndex++;
                    frame.phase = "repeat_check";
                    continue;
                }
            }

            if (frame.kind === "stage") {
                if (frame.phase === "enter") {
                    frame.phase = "run";
                    continue;
                }

                if (frame.phase === "run") {
                    if (frame.index >= frame.seq.length) {
                        this.callStack.pop();
                        return {
                            done: false,
                            event: this.log(DEBUG_EVENT.STAGE_EXIT, {
                                stage: frame.stageName
                            })
                        };
                    }

                    const stmt = frame.seq[frame.index++];
                    this.callStack.push({
                        kind: "statement",
                        stmt,
                        env: frame.env,
                        state: frame.state,
                        phase: "enter"
                    });
                    continue;
                }
            }

            if (frame.kind === "statement") {
                const stmt = frame.stmt;

                if (frame.phase === "enter") {
                    this.callStack.pop();

                    switch (stmt.type) {
                        case "group": {
                            const childState = cloneState(frame.state);
                            this.callStack.push({
                                kind: "group",
                                seq: stmt.seq,
                                env: frame.env,
                                state: childState,
                                phase: "enter",
                                index: 0
                            });
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.GROUP_ENTER, {})
                            };
                        }

                        case "transform": {
                            this.applyTransform(stmt, frame.env, frame.state);
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.TRANSFORM, {
                                    op: stmt.op,
                                    values: stmt.args.map(a => ExprEval.eval(a, frame.env, this)),
                                    state: snapshotState(frame.state)
                                })
                            };
                        }

                        case "random_variable": {
                            const value = this.applyRandomVariable(stmt, frame.env);
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.STATEMENT, {
                                    kind: "random_variable",
                                    name: stmt.name,
                                    value,
                                    integer: !!stmt.integer
                                })
                            };
                        }

                        case "reroll_variable": {
                            const value = this.rerollVariable(stmt.name, frame.env);
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.STATEMENT, {
                                    kind: "reroll_variable",
                                    name: stmt.name,
                                    value
                                })
                            };
                        }

                        case "instance": {
                            const inst = this.emitInstance(stmt, frame.env, frame.state);
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.INSTANCE, inst)
                            };
                        }

                        case "conditional": {
                            const condVal = !!ExprEval.eval(stmt.cond, frame.env, this);
                            const call = condVal ? stmt.ruleMain : stmt.ruleAlt;
                            const branch = condVal ? stmt.branchMain : stmt.branchAlt;
                            this.log(DEBUG_EVENT.CONDITIONAL, {
                                result: condVal,
                                hasAlt: !!(stmt.ruleAlt || stmt.branchAlt),
                                branchLength: Array.isArray(branch) ? branch.length : 0
                            });
                            if (Array.isArray(branch) && branch.length > 0) {
                                this.callStack.push(makeStageFrame("conditional", branch, frame.env, frame.state));
                            }
                            if (call) {
                                const argVals = call.args.map(a => ExprEval.eval(a, frame.env, this));
                                this.callStack.push({
                                    kind: "call_deferred",
                                    call,
                                    env: frame.env,
                                    state: frame.state,
                                    args: argVals
                                });
                            }
                            return {
                                done: false,
                                event: this.debug[this.debug.length - 1]
                            };
                        }

                        case "rule_call": {
                            const argVals = stmt.args.map(a => ExprEval.eval(a, frame.env, this));
                            this.callStack.push({
                                kind: "call_deferred",
                                call: stmt,
                                env: frame.env,
                                state: frame.state,
                                args: argVals
                            });
                            return {
                                done: false,
                                event: this.log(DEBUG_EVENT.CALL, {
                                    rule: stmt.name,
                                    args: argVals
                                })
                            };
                        }

                        default:
                            throw new Error(`Unknown statement type ${stmt.type}`);
                    }
                }
            }

            if (frame.kind === "call_deferred") {
                this.callStack.pop();
                this.invokeRule(frame.call.name, frame.args, frame.env, frame.state);
                continue;
            }

            if (frame.kind === "group") {
                if (frame.phase === "enter") {
                    frame.phase = "run";
                    continue;
                }

                if (frame.phase === "run") {
                    if (frame.index >= frame.seq.length) {
                        this.callStack.pop();
                        return {
                            done: false,
                            event: this.log(DEBUG_EVENT.GROUP_EXIT, {})
                        };
                    }

                    const stmt = frame.seq[frame.index++];
                    this.callStack.push({
                        kind: "statement",
                        stmt,
                        env: frame.env,
                        state: frame.state,
                        phase: "enter"
                    });
                    continue;
                }
            }
        }

        this.finished = true;
        return { done: true, event: null };
    }

    runAll() {
        while (!this.finished) {
            this.step();
        }
        return this.emittedItems;
    }

    allocateGlobalDeformScope() {
        const scopeId = this.globalDeformScopeCounter++;
        return `gscope:${scopeId}`;
    }

    applyTransform(stmt, env, state) {
        const vals = stmt.args.map(a => ExprEval.eval(a, env, this));
        const wasGlobalDeformActive = globalAxisDeformIsActive(state);

        switch (stmt.op) {
            case "T":
                state.T[0] += vals[0];
                state.T[1] += vals[1];
                state.T[2] += vals[2];
                state.M = matMultiply(state.M || matIdentity(), matTranslation(vals[0], vals[1], vals[2]));
                break;

            case "S":
                state.S[0] *= vals[0];
                state.S[1] *= vals[1];
                state.S[2] *= vals[2];
                state.M = matMultiply(state.M || matIdentity(), matScale(vals[0], vals[1], vals[2]));
                break;

            case "A":
            case "R": {
                const angle = vals[0];
                const axis = Math.floor(vals[1]);
                if (axis >= 0 && axis <= 2) state.A[axis] += angle;
                const rad = angle * (Math.PI / 180);
                if (axis === 0) state.M = matMultiply(state.M || matIdentity(), matRotX(rad));
                if (axis === 1) state.M = matMultiply(state.M || matIdentity(), matRotY(rad));
                if (axis === 2) state.M = matMultiply(state.M || matIdentity(), matRotZ(rad));
                break;
            }

            case "DSX": state.DSX = vals; break;
            case "DSY": state.DSY = vals; break;
            case "DSZ": state.DSZ = vals; break;
            case "DTX": state.DTX = vals; break;
            case "DTY": state.DTY = vals; break;
            case "DTZ": state.DTZ = vals; break;
            case "GDSX": state.GDSX = vals; break;
            case "GDSY": state.GDSY = vals; break;
            case "GDSZ": state.GDSZ = vals; break;
            case "GDTX": state.GDTX = vals; break;
            case "GDTY": state.GDTY = vals; break;
            case "GDTZ": state.GDTZ = vals; break;

            default:
                throw new Error(`Unknown transform op ${stmt.op}`);
        }

        if (stmt.op.startsWith("GD")) {
            const isGlobalDeformActive = globalAxisDeformIsActive(state);
            if (!wasGlobalDeformActive && isGlobalDeformActive) {
                state.GDSCOPE = this.allocateGlobalDeformScope();
            } else if (wasGlobalDeformActive && !isGlobalDeformActive) {
                state.GDSCOPE = null;
            }
        }
    }

    applyRandomVariable(stmt, env) {
        let min = Number(ExprEval.eval(stmt.minExpr, env, this));
        let max = Number(ExprEval.eval(stmt.maxExpr, env, this));
        if (!Number.isFinite(min)) min = 0;
        if (!Number.isFinite(max)) max = min;
        if (min > max) {
            const swap = min;
            min = max;
            max = swap;
        }

        let value;
        if (stmt.integer) {
            const lo = Math.ceil(min);
            const hi = Math.floor(max);
            if (hi < lo) {
                value = lo;
            } else {
                value = lo + Math.floor(this.rng.next() * (hi - lo + 1));
            }
        } else {
            value = min === max ? min : min + (max - min) * this.rng.next();
        }

        env[stmt.name] = value;
        if (env && env.__randomRanges) {
            env.__randomRanges[stmt.name] = {
                min,
                max,
                integer: !!stmt.integer
            };
        }
        return value;
    }

    rerollVariable(name, env) {
        const ranges = env && env.__randomRanges ? env.__randomRanges : null;
        const entry = ranges ? ranges[name] : null;
        if (!entry) {
            throw new Error(`Random variable not found: ${name}`);
        }
        let min = Number(entry.min);
        let max = Number(entry.max);
        if (!Number.isFinite(min)) min = 0;
        if (!Number.isFinite(max)) max = min;
        if (min > max) {
            const swap = min;
            min = max;
            max = swap;
        }

        let value;
        if (entry.integer) {
            const lo = Math.ceil(min);
            const hi = Math.floor(max);
            value = hi < lo ? lo : lo + Math.floor(this.rng.next() * (hi - lo + 1));
        } else {
            value = min === max ? min : min + (max - min) * this.rng.next();
        }
        env[name] = value;
        return value;
    }

    emitInstance(stmt, env, state) {
        const scale = ExprEval.eval(stmt.scaleExpr, env, this);
        const item = {
            type: "instance",
            primitive: stmt.primitive,
            texture: stmt.texture,
            scale,
            state: snapshotState(state)
        };
        this.emittedItems.push(item);
        this.advanceAfterAxisPrimitive(stmt.primitive, state);
        return item;
    }

    advanceAfterAxisPrimitive(primitive, state) {
        const step = primitiveForwardStep(primitive);
        if (!step) return;
        state.M = matMultiply(state.M || matIdentity(), matTranslation(step[0], step[1], step[2]));
        syncLegacyChannelsFromMatrix(state);
    }

    getDebugLog() {
        return [...this.debug];
    }

    getOutput() {
        return [...this.emittedItems];
    }
}

function makeStageFrame(stageName, seq, env, state) {
    return {
        kind: "stage",
        stageName,
        seq: seq || [],
        env,
        state,
        index: 0,
        phase: "enter"
    };
}

function snapshotEnv(env) {
    const out = {};
    if (!env) return out;
    for (const k in env) {
        out[k] = env[k];
    }
    return out;
}

function snapshotState(state) {
    const out = cloneState(state);
    out.M = Array.from(out.M || matIdentity());
    return out;
}

class GrammarDebugger {
    constructor(runtime) {
        this.runtime = runtime;
    }

    step() {
        return this.runtime.step();
    }

    run(steps = Infinity) {
        const events = [];
        let count = 0;
        while (!this.runtime.finished && count < steps) {
            const res = this.runtime.step();
            if (res.event) events.push(res.event);
            count++;
        }
        return {
            done: this.runtime.finished,
            events,
            output: this.runtime.getOutput()
        };
    }

    runAll() {
        return {
            output: this.runtime.runAll(),
            debug: this.runtime.getDebugLog()
        };
    }

    state() {
        return {
            finished: this.runtime.finished,
            stepCount: this.runtime.stepCount,
            outputCount: this.runtime.emittedItems.length,
            stackDepth: this.runtime.callStack.length
        };
    }
}

function parseGrammar(text, options = {}) {
    const parser = new GrammarParser(text, options);
    return parser.parse();
}

function createRuntime(textOrGrammar, options = {}) {
    const grammar = typeof textOrGrammar === "string"
        ? parseGrammar(textOrGrammar, options)
        : textOrGrammar;
    return new GrammarRuntime(grammar, options);
}

function createDebugger(textOrGrammar, options = {}) {
    const runtime = createRuntime(textOrGrammar, options);
    return new GrammarDebugger(runtime);
}

function compileGrammar(text, options = {}) {
    const grammar = parseGrammar(text, options);
    const runtime = new GrammarRuntime(grammar, options);
    return {
        grammar,
        runtime,
        run(startRule = undefined) {
            if (startRule && startRule !== runtime.entry) {
                runtime.entry = startRule;
                runtime.callStack = [{
                    kind: "rule_frame",
                    ruleName: runtime.entry,
                    env: {},
                    state: makeDefaultState(),
                    phase: "enter"
                }];
                runtime.emittedItems = [];
                runtime.debug = [];
                runtime.stepCount = 0;
                runtime.finished = false;
            }
            return runtime.runAll();
        }
    };
}

(function (global) {
    'use strict';
    if (!global) return;

    function _p3dSafeAttach(name, value) {
        if (typeof value === 'function' || (value && typeof value === 'object')) {
            if (typeof global[name] === 'undefined') {
                global[name] = value;
            }
        }
    }

    if (typeof GrammarToken === 'function') _p3dSafeAttach('GrammarToken', GrammarToken);
    if (typeof GrammarTokenizer === 'function') _p3dSafeAttach('GrammarTokenizer', GrammarTokenizer);
    if (typeof parseGrammar === 'function') _p3dSafeAttach('parseGrammar', parseGrammar);
    if (typeof createRuntime === 'function') _p3dSafeAttach('createRuntime', createRuntime);
    if (typeof createDebugger === 'function') _p3dSafeAttach('createDebugger', createDebugger);
    if (typeof compileGrammar === 'function') _p3dSafeAttach('compileGrammar', compileGrammar);

    if (typeof global.Grammar === 'undefined' && typeof parseGrammar === 'function') {
        function Grammar(fileText, options = {}) {
            if (!(this instanceof Grammar)) {
                return new Grammar(fileText, options);
            }

            this.fileText = String(fileText || '');
            this.source = this.fileText;
            this.options = options || {};

            this.grammarTokenizer = null;
            this.lexerTokens = [];
            this.parserTokens = [];
            this.visualTokens = [];
            this.tokens = [];
            this.token_index = 0;
            this.debug_info = {
                sourceLength: this.fileText.length,
                lineCount: 1,
                lexer: null,
                parser: null,
                constructor: []
            };

            try {
                this.debug_info.lineCount = this.fileText.length
                    ? this.fileText.split(/\r\n|\r|\n/).length
                    : 1;

                this.grammarTokenizer = new GrammarTokenizer(this.fileText, {
                    emitWhitespace: true,
                    emitNewlines: true,
                    debug: !!this.options.debug
                });

                this.lexerTokens = Array.isArray(this.grammarTokenizer.tokens)
                    ? this.grammarTokenizer.tokens.map(t => ({
                        type: t.type,
                        value: t.value,
                        pos: t.pos,
                        line: t.line,
                        col: t.col,
                        endPos: t.endPos
                    }))
                    : [];

                this.parserTokens = Array.isArray(this.grammarTokenizer.parserTokens)
                    ? this.grammarTokenizer.parserTokens.map(t => ({
                        type: t.type,
                        value: t.value,
                        pos: t.pos,
                        line: t.line,
                        col: t.col,
                        endPos: t.endPos
                    }))
                    : [];

                this.tokens = this.lexerTokens.map(t => ({ ...t }));
                this.visualTokens = this.lexerTokens.map(t => ({ ...t }));

                this.debug_info.lexer = this.grammarTokenizer.getDebugInfo();
            } catch (lexerError) {
                const location = lexerError && lexerError.message ? pg3dExtractLineColFromMessage(lexerError.message) : null;
                pg3dEmitParseConsole('error', `[grammar] lexer failed: ${lexerError && lexerError.message ? lexerError.message : lexerError}`, {
                    phase: 'lexer',
                    line: location ? location.line : undefined,
                    col: location ? location.col : undefined,
                    snippet: location ? pg3dLineSnippet(this.fileText, location.line) : undefined
                });
                try { console.error('PG3D lexer bridge failed before AST parse.', lexerError); } catch (_) {}
                throw lexerError;
            }

            try {
                this.ast = parseGrammar(this.fileText, {
                    emitWhitespace: true,
                    emitNewlines: true,
                    debug: !!this.options.debug
                });
            } catch (parseError) {
                const location = parseError && parseError.message ? pg3dExtractLineColFromMessage(parseError.message) : null;
                if (location) {
                    parseError.line = location.line;
                    parseError.col = location.col;
                    parseError.snippet = pg3dLineSnippet(this.fileText, location.line);
                }
                pg3dEmitParseConsole('error', `[grammar] parse failed: ${parseError && parseError.message ? parseError.message : parseError}`, {
                    phase: 'parser',
                    line: location ? location.line : undefined,
                    col: location ? location.col : undefined,
                    snippet: location ? pg3dLineSnippet(this.fileText, location.line) : undefined,
                    sourceLength: this.fileText.length,
                    lineCount: this.debug_info.lineCount,
                    lexTokenCount: this.lexerTokens.length,
                    parseTokenCount: this.parserTokens.length
                });
                throw parseError;
            }

            if ((!Array.isArray(this.visualTokens) || this.visualTokens.length === 0) &&
                Array.isArray(this.lexerTokens) && this.lexerTokens.length > 0) {
                this.visualTokens = this.lexerTokens.map(t => ({ ...t }));
            }

            if ((!Array.isArray(this.tokens) || this.tokens.length === 0) &&
                Array.isArray(this.lexerTokens) && this.lexerTokens.length > 0) {
                this.tokens = this.lexerTokens.map(t => ({ ...t }));
            }

            this.entry = this.ast && this.ast.entry ? this.ast.entry : 'Start';
            this.order = this.ast && this.ast.order ? this.ast.order : [];
            this.rules = this.ast && this.ast.rules ? this.ast.rules : new Map();

            this.debug_info.parser = this.ast && this.ast.debug ? this.ast.debug : null;
            this.debug_info.constructor.push({
                type: "grammar_constructed",
                sourceLength: this.fileText.length,
                lineCount: this.debug_info.lineCount,
                lexTokenCount: this.lexerTokens.length,
                parseTokenCount: this.parserTokens.length,
                uiTokenCount: this.visualTokens.length,
                ruleCount: this.order.length,
                entry: this.entry
            });
            pg3dEmitParseConsole('info', `[grammar] constructed entry=${this.entry} rules=${this.order.length} ui=${this.visualTokens.length} parse=${this.parserTokens.length}`, {
                entry: this.entry,
                rules: [...this.order],
                sourceLength: this.fileText.length,
                lineCount: this.debug_info.lineCount,
                lexTokenCount: this.lexerTokens.length,
                parseTokenCount: this.parserTokens.length,
                uiTokenCount: this.visualTokens.length
            });
            if (this.order.length) {
                pg3dEmitParseConsole('info', `[grammar] rule order: ${this.order.join(', ')}`, {
                    rules: [...this.order]
                });
            }

            this.peekToken = (offset = 0) => {
                return this.visualTokens[this.token_index + offset] || this.visualTokens[this.visualTokens.length - 1] || null;
            };

            this.nextToken = () => {
                const t = this.visualTokens[this.token_index] || this.visualTokens[this.visualTokens.length - 1] || null;
                if (this.token_index < this.visualTokens.length) this.token_index++;
                return t;
            };

            this.resetTokens = () => {
                this.token_index = 0;
                return this.visualTokens;
            };

            this.getDebugInfo = () => ({
                sourceLength: this.debug_info.sourceLength,
                lineCount: this.debug_info.lineCount,
                entry: this.entry,
                ruleCount: this.order.length,
                lexTokenCount: this.lexerTokens.length,
                parseTokenCount: this.parserTokens.length,
                uiTokenCount: this.visualTokens.length,
                whitespaceTokenCount: this.lexerTokens.filter(t => t.type === "ws").length,
                newlineTokenCount: this.lexerTokens.filter(t => t.type === "nl").length,
                commentTokenCount: this.lexerTokens.filter(t => t.type === "comment_line" || t.type === "comment_block").length,
                lexer: this.debug_info.lexer,
                parser: this.debug_info.parser,
                constructor: [...this.debug_info.constructor]
            });

            this.dumpDebug = () => {
                const dbg = this.getDebugInfo();
                try {
                    console.group('PG3D Grammar Debug');
                    console.log('Summary:', dbg);
                    console.log('First visual tokens:', this.visualTokens.slice(0, 50));
                    console.log('First parse tokens:', this.parserTokens.slice(0, 50));
                    if (dbg.parser) console.log('Parser debug:', dbg.parser);
                    if (dbg.lexer) console.log('Lexer debug:', dbg.lexer);
                    console.groupEnd();
                } catch (_) {}
                return dbg;
            };

            try {
                console.log('PG3D Grammar constructed:', {
                    sourceLength: this.fileText.length,
                    lineCount: this.debug_info.lineCount,
                    lexTokenCount: this.lexerTokens.length,
                    parseTokenCount: this.parserTokens.length,
                    uiTokenCount: this.visualTokens.length,
                    wsTokenCount: this.lexerTokens.filter(t => t.type === "ws").length,
                    nlTokenCount: this.lexerTokens.filter(t => t.type === "nl").length,
                    commentTokenCount: this.lexerTokens.filter(t => t.type === "comment_line" || t.type === "comment_block").length,
                    entry: this.entry,
                    rules: this.order.length
                });

                if (Array.isArray(this.visualTokens) && this.visualTokens.length > 0) {
                    console.log('PG3D first visual tokens:', this.visualTokens.slice(0, 20));
                } else {
                    console.warn('PG3D visualTokens is empty after constructor.');
                }

                if (Array.isArray(this.parserTokens) && this.parserTokens.length > 0) {
                    console.log('PG3D first parse tokens:', this.parserTokens.slice(0, 20));
                }
            } catch (_) {}

            try {
                if (this && this.visualTokens && this.visualTokens.length === 0) {
                    if (typeof this.prepare === 'function' && this.prepare.length === 0) {
                        this.prepare();
                    }
                }

                if (this && this.visualTokens && this.visualTokens.length === 0) {
                    if (typeof this.findRule === 'function' && typeof this.Recurse === 'function') {
                        const entry = (this.start_rule || (this.ast && (this.ast.entry || this.ast.start)) || 'Start');
                        const rule = this.findRule(entry);
                        if (rule) this.Recurse(rule);
                    }
                }

                if (this && this.visualTokens && this.visualTokens.length === 0) {
                    const root = (typeof window !== 'undefined')
                        ? window
                        : (typeof globalThis !== 'undefined' ? globalThis : this);
                    const maybeEmit = root && (root.emitTokensFromAst || root.emitTokens || root.buildTokensFromAst);
                    if (typeof maybeEmit === 'function' && this.ast) {
                        const out = maybeEmit(this.ast);
                        if (Array.isArray(out)) {
                            this.visualTokens = out;
                        }
                    }
                }
            } catch (e) {
                try { console.error('PG3D token emission failed (Grammar.visualTokens remains empty).', e); } catch (_) {}
                throw e;
            }
        }

        global.Grammar = Grammar;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));


//------------------------------------------------
// PG3D prepare(tokens, scene) global compatibility bridge
//------------------------------------------------
(function (global) {
    'use strict';
    if (!global) return;

    function _pg3dLog(kind, message, meta) {
        try {
            if (typeof global.PG3D_LOG === 'function') {
                global.PG3D_LOG(kind, message, meta);
                return;
            }
        } catch (_) {}
        try {
            const fn = kind === 'error' ? console.error : (kind === 'warn' ? console.warn : console.log);
            fn.call(console, message, meta || '');
        } catch (_) {}
    }

    function _pg3dClone(v) {
        if (Array.isArray(v)) return v.map(_pg3dClone);
        if (v && typeof v === 'object') {
            const out = {};
            for (const k in v) out[k] = _pg3dClone(v[k]);
            return out;
        }
        return v;
    }

    function _pg3dGetActiveGrammar() {
        if (global.__PG3D_ACTIVE_GRAMMAR__ && typeof global.__PG3D_ACTIVE_GRAMMAR__ === 'object') {
            return global.__PG3D_ACTIVE_GRAMMAR__;
        }
        return null;
    }

    function _pg3dMat4Api() {
        if (typeof Mat4 !== 'undefined') return Mat4;
        return {
            identity() {
                return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            },
            multiply(a, b) {
                const c = new Float32Array(16);
                for (let col = 0; col < 4; col++) {
                    const bi = col * 4;
                    const b0 = b[bi + 0], b1 = b[bi + 1], b2 = b[bi + 2], b3 = b[bi + 3];
                    c[bi + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
                    c[bi + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
                    c[bi + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
                    c[bi + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
                }
                return c;
            },
            translation(tx, ty, tz) {
                const m = this.identity();
                m[12] = tx;
                m[13] = ty;
                m[14] = tz;
                return m;
            },
            scale(sx, sy, sz) {
                const m = this.identity();
                m[0] = sx;
                m[5] = sy;
                m[10] = sz;
                return m;
            },
            rotX(rad) {
                const c = Math.cos(rad), s = Math.sin(rad);
                return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
            },
            rotY(rad) {
                const c = Math.cos(rad), s = Math.sin(rad);
                return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
            },
            rotZ(rad) {
                const c = Math.cos(rad), s = Math.sin(rad);
                return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            }
        };
    }

    function _pg3dMakeTransformMatrix(spec) {
        const math = _pg3dMat4Api();
        const s = spec || {};
        const T = Array.isArray(s.T) ? s.T : [0, 0, 0];
        const S = Array.isArray(s.S) ? s.S : [1, 1, 1];
        const A = Array.isArray(s.A) ? s.A : [0, 0, 0];
        const deg = Math.PI / 180;

        let m = math.scale(S[0], S[1], S[2]);
        m = math.multiply(math.rotX((A[0] || 0) * deg), m);
        m = math.multiply(math.rotY((A[1] || 0) * deg), m);
        m = math.multiply(math.rotZ((A[2] || 0) * deg), m);
        m = math.multiply(math.translation(T[0] || 0, T[1] || 0, T[2] || 0), m);
        return m;
    }

    function _pg3dMakeTransformFromState(state) {
        const s = state || {};

        if (Array.isArray(s.M) || s.M instanceof Float32Array) {
            return new Float32Array(s.M);
        }

        const T = Array.isArray(s.T) ? s.T : [0, 0, 0];
        const S = Array.isArray(s.S) ? s.S : [1, 1, 1];
        const A = Array.isArray(s.A) ? s.A : [0, 0, 0];

        return _pg3dMakeTransformMatrix({
            T: [T[0], T[1], T[2]],
            S: [S[0], S[1], S[2]],
            A: [A[0], A[1], A[2]]
        });
    }

    function _pg3dMakeAxisTransform(scaleVec, translateVec) {
        const s = Array.isArray(scaleVec) ? scaleVec : [1, 1, 1];
        const t = Array.isArray(translateVec) ? translateVec : [0, 0, 0];
        return _pg3dMakeTransformMatrix({
            T: [t[0], t[1], t[2]],
            S: [s[0], s[1], s[2]],
            A: [0, 0, 0]
        });
    }

function _pg3dAxisNameFromPrimitive(type) {
    if (type === 'CubeX') return 'x';
    if (type === 'CubeY') return 'y';
    return 'z';
}

function _pg3dTextureIndex(texture) {
    if (typeof texture === 'number' && Number.isFinite(texture)) return texture;
    if (typeof texture === 'string') {
        const n = Number(texture);
        if (Number.isFinite(n)) return n;
        return texture;
    }
    return 0;
}

function _pg3dSceneAdd(scene, payload) {
    if (!scene || !payload) return false;

    const type = payload.primitive || payload.type || 'Cube';
    const scale = payload.scale != null ? payload.scale : 0.125;
    const state = payload.state || payload;
    const dsx = state.DSX || [1, 1, 1];
    const dsy = state.DSY || [1, 1, 1];
    const dsz = state.DSZ || [1, 1, 1];
    const dtx = state.DTX || [0, 0, 0];
    const dty = state.DTY || [0, 0, 0];
    const dtz = state.DTZ || [0, 0, 0];

    const transform1 = _pg3dMakeTransformFromState(state);
    const transform2 = _pg3dMakeAxisTransform(dsx, dtx);
    const transform3 = _pg3dMakeAxisTransform(dsy, dty);

    const texIndex = _pg3dTextureIndex(payload.texture);
    const arg = 0;
    const val = Number.isFinite(scale) ? Number(scale) : 0.125;
    const axisName = _pg3dAxisNameFromPrimitive(type);
    const axisDeform = {
        active: true,
        dsx: _pg3dClone(dsx),
        dsy: _pg3dClone(dsy),
        dsz: _pg3dClone(dsz),
        dtx: _pg3dClone(dtx),
        dty: _pg3dClone(dty),
        dtz: _pg3dClone(dtz)
    };
    const globalAxisDeform = {
        active: true,
        dsx: _pg3dClone(state.GDSX || [1, 1, 1]),
        dsy: _pg3dClone(state.GDSY || [1, 1, 1]),
        dsz: _pg3dClone(state.GDSZ || [1, 1, 1]),
        dtx: _pg3dClone(state.GDTX || [0, 0, 0]),
        dty: _pg3dClone(state.GDTY || [0, 0, 0]),
        dtz: _pg3dClone(state.GDTZ || [0, 0, 0]),
        scopeId: state.GDSCOPE || null
    };

    if (typeof scene.add === 'function') {
        scene.add(type, transform1, transform2, transform3, texIndex, arg, val, axisName, axisDeform, globalAxisDeform);
        return true;
    }

    if (typeof scene.addInstance === 'function') {
        scene.addInstance({
            type,
            transform1,
            transform2,
            transform3,
            texIndex,
            arg,
            val,
            axisName,
            axisDeform,
            globalAxisDeform
        });
        return true;
    }

    if (Array.isArray(scene.items)) {
        scene.items.push({
            type,
            transform1,
            transform2,
            transform3,
            texIndex,
            arg,
            val,
            axisName,
            axisDeform,
            globalAxisDeform
        });
        return true;
    }

    return false;
}
    function _pg3dRuntimeFromGrammar(grammarObj) {
        if (!grammarObj) {
            throw new Error('No active Grammar object found.');
        }

        const sourceText =
            typeof grammarObj.fileText === 'string' ? grammarObj.fileText :
            typeof grammarObj.source === 'string' ? grammarObj.source :
            '';

        if (!sourceText.trim()) return [];

        if (typeof createRuntime !== 'function') {
            throw new Error('createRuntime is not available globally.');
        }

        const runtime = createRuntime(sourceText, {
            debug: !!(grammarObj.options && grammarObj.options.debug),
            seed: grammarObj.options && grammarObj.options.seed
        });

        return runtime.runAll();
    }

function _pg3dInstanceToScenePayload(item) {
    return {
        type: item.primitive || 'Cube',
        primitive: item.primitive || 'Cube',
        texture: item.texture || '',
        scale: item.scale != null ? item.scale : 1,
        state: _pg3dClone(item.state || {}),
        T: item.state && item.state.T ? _pg3dClone(item.state.T) : [0, 0, 0],
        S: item.state && item.state.S ? _pg3dClone(item.state.S) : [1, 1, 1],
        A: item.state && item.state.A ? _pg3dClone(item.state.A) : [0, 0, 0],
        DSX: item.state && item.state.DSX ? _pg3dClone(item.state.DSX) : [1, 1, 1],
        DSY: item.state && item.state.DSY ? _pg3dClone(item.state.DSY) : [1, 1, 1],
        DSZ: item.state && item.state.DSZ ? _pg3dClone(item.state.DSZ) : [1, 1, 1],
        DTX: item.state && item.state.DTX ? _pg3dClone(item.state.DTX) : [0, 0, 0],
        DTY: item.state && item.state.DTY ? _pg3dClone(item.state.DTY) : [0, 0, 0],
        DTZ: item.state && item.state.DTZ ? _pg3dClone(item.state.DTZ) : [0, 0, 0],
        GDSX: item.state && item.state.GDSX ? _pg3dClone(item.state.GDSX) : [1, 1, 1],
        GDSY: item.state && item.state.GDSY ? _pg3dClone(item.state.GDSY) : [1, 1, 1],
        GDSZ: item.state && item.state.GDSZ ? _pg3dClone(item.state.GDSZ) : [1, 1, 1],
        GDTX: item.state && item.state.GDTX ? _pg3dClone(item.state.GDTX) : [0, 0, 0],
        GDTY: item.state && item.state.GDTY ? _pg3dClone(item.state.GDTY) : [0, 0, 0],
        GDTZ: item.state && item.state.GDTZ ? _pg3dClone(item.state.GDTZ) : [0, 0, 0],
        GDSCOPE: item.state && Object.prototype.hasOwnProperty.call(item.state, 'GDSCOPE') ? item.state.GDSCOPE : null
    };
}

    function prepare(tokens, scene) {
        const grammarObj = _pg3dGetActiveGrammar();
        if (!grammarObj) {
            throw new Error(
                'prepare(tokens, scene) could not find window.__PG3D_ACTIVE_GRAMMAR__.'
            );
        }

        const output = _pg3dRuntimeFromGrammar(grammarObj);

        if (scene && typeof scene.clear === 'function') {
            scene.clear();
        }

        let accepted = 0;
        for (const item of output) {
            if (!item || item.type !== 'instance') continue;
            const payload = _pg3dInstanceToScenePayload(item);
            if (_pg3dSceneAdd(scene, payload)) {
                accepted++;
            }
        }

        if (scene && typeof scene.applyGlobalAxisDeform === 'function') {
            scene.applyGlobalAxisDeform();
        }

        _pg3dLog(
            'info',
            `[prepare-bridge] runtime output=${output.length}, scene accepted=${accepted}`
        );

        return output;
    }

    global.prepare = prepare;
    _pg3dLog('info', '[prepare-bridge] global prepare(tokens, scene) registered.');
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
