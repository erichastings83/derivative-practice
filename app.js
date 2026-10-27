function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStoredInt(key, defaultVal) {
    try {
        let v = parseInt(localStorage.getItem(key) || defaultVal, 10);
        return isNaN(v) ? parseInt(defaultVal, 10) : v;
    } catch(e) {
        return parseInt(defaultVal, 10);
    }
}

function safeSetItem(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
}

const state = {
    rules: { basic: true, product: true, quotient: true, chain: true },
    difficulty: 'easy', // easy, medium, hard, very hard
    mode: 'practice', // practice, survival
    lives: 3,
    gameOver: false,
    timeUp: false,
    timeLeft: 0,
    practiceTimeLimit: 0,
    timerActive: false,
    problem: null, 
    score: 0,
    streak: 0,
    highScore: getStoredInt('calc_highScore', '0'),
    maxStreak: getStoredInt('calc_maxStreak', '0'),
    taHighScore: getStoredInt('calc_taHighScore', '0'),
    xp: getStoredInt('calc_xp', '0'),
    level: getStoredInt('calc_level', '1'),
    feedbackText: '',
    feedbackClass: '',
    waitingForNext: false,
    stepsRevealed: 0,
    selectedRule: null,
    selectedQuizOption: null,
    currentInput: '',
    lastSubmitTime: 0
};

function getXpForLevel(lvl) {
    return lvl * 100;
}

function saveStats() {
    if (state.mode === 'timeAttack' && state.score > state.taHighScore) state.taHighScore = state.score;
    else if (state.mode !== 'timeAttack' && state.score > state.highScore) state.highScore = state.score;
    
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    
    safeSetItem('calc_highScore', state.highScore);
    safeSetItem('calc_taHighScore', state.taHighScore);
    safeSetItem('calc_maxStreak', state.maxStreak);
    safeSetItem('calc_xp', state.xp);
    safeSetItem('calc_level', state.level);
}

let timerIntervalId = null;

// Math Utilities
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rnz = (min, max) => {
    let v = rnd(min, max);
    let attempts = 0;
    while (v === 0 && attempts++ < 100) v = rnd(min, max);
    return v;
};
const abs = Math.abs;

// Generate random variables
const getVar = () => {
    const vars = ['x', 't', 'y', 'w'];
    return vars[rnd(0, vars.length - 1)];
};

// Generate random function notation
const getNotation = (v) => {
    let notations = [
        { type: 'f', str: `f(${v})`, derivStr: `f'(${v})` },
        { type: 'g', str: `g(${v})`, derivStr: `g'(${v})` },
        { type: 'h', str: `h(${v})`, derivStr: `h'(${v})` },
        { type: 'y', str: `y`, derivStr: `\\frac{dy}{d${v}}` },
        { type: 'd', str: `\\frac{d}{d${v}}`, derivStr: null }
    ];
    if (v === 'y') {
        notations = notations.filter(n => n.type !== 'y');
    }
    return notations[rnd(0, notations.length - 1)];
};

// Structural Parts Logic for Simplification
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);

function createPart(num, den, tex, factors = null) {
    if (num === 0) return { num: 0, den: 1, tex: '', factors: [] };
    let g = gcd(abs(num), abs(den));
    let n = num / g;
    let d = den / g;
    if (d < 0) { n = -n; d = -d; }
    return { num: n, den: d, tex, factors: factors || (tex ? [tex] : []) };
}

function multiplyParts(partsA, partsB) {
    const res = [];
    for (let a of partsA) {
        for (let b of partsB) {
            if (a.num === 0 || b.num === 0) continue;
            let n = a.num * b.num;
            let d = a.den * b.den;
            
            let combinedFactors = [...a.factors, ...b.factors];
            
            // Reduce power functions
            let varPowers = {};
            let newFactors = [];
            
            for (let f of combinedFactors) {
                let mVar = f.match(/^[xtyw]$/);
                if (mVar) {
                    varPowers[f] = fracAdd(varPowers[f] || {n:0, d:1}, {n:1, d:1});
                    continue;
                }
                
                let mPower = f.match(/^([xtyw])\^([0-9]+)$/);
                if (mPower) {
                    varPowers[mPower[1]] = fracAdd(varPowers[mPower[1]] || {n:0, d:1}, {n:parseInt(mPower[2]), d:1});
                    continue;
                }
                
                let mPowerBrace = f.match(/^([xtyw])\^\{([0-9-]+)\}$/);
                if (mPowerBrace) {
                    varPowers[mPowerBrace[1]] = fracAdd(varPowers[mPowerBrace[1]] || {n:0, d:1}, {n:parseInt(mPowerBrace[2]), d:1});
                    continue;
                }
                
                let mFrac = f.match(/^\\frac\{1\}\{([xtyw])\}$/);
                if (mFrac) {
                    varPowers[mFrac[1]] = fracSub(varPowers[mFrac[1]] || {n:0, d:1}, {n:1, d:1});
                    continue;
                }
                
                let mPowerFrac = f.match(/^([xtyw])\^\{\\frac\{([0-9-]+)\}\{([0-9]+)\}\}$/);
                if (mPowerFrac) {
                    varPowers[mPowerFrac[1]] = fracAdd(varPowers[mPowerFrac[1]] || {n:0, d:1}, {n:parseInt(mPowerFrac[2]), d:parseInt(mPowerFrac[3])});
                    continue;
                }
                
                let mPowerFracBot = f.match(/^\\frac\{1\}\{([xtyw])\^\{\\frac\{([0-9-]+)\}\{([0-9]+)\}\}\}$/);
                if (mPowerFracBot) {
                    varPowers[mPowerFracBot[1]] = fracSub(varPowers[mPowerFracBot[1]] || {n:0, d:1}, {n:parseInt(mPowerFracBot[2]), d:parseInt(mPowerFracBot[3])});
                    continue;
                }
                
                newFactors.push(f);
            }
            
            for (let v in varPowers) {
                let k = varPowers[v];
                if (k.n === 0) continue;
                let kStr = fracToStr(k);
                let tex = formatPolyPower(kStr, v);
                if (tex) newFactors.push(tex);
            }
            
            combinedFactors = newFactors;
            
            combinedFactors.sort((f1, f2) => {
                const getRank = (f) => {
                    if (/^[xtyw]/.test(f) || /^\\frac\{1\}\{[xtyw]/.test(f)) return 1;
                    return 5;
                };
                return getRank(f1) - getRank(f2);
            });
            
            let tex = '';
            for (let f of combinedFactors) {
                if (!tex) {
                    tex = f;
                } else {
                    let sep = '';
                    if (/[0-9]$/.test(tex) && /^[0-9]/.test(f)) {
                        sep = ' \\cdot ';
                    }
                    tex += sep + f;
                }
            }
            
            res.push(createPart(n, d, tex, combinedFactors));
        }
    }
    return res;
}

function combineSameTex(parts) {
    if (!parts || parts.length === 0) return [];
    const map = new Map();
    for (let p of parts) {
        if (!p || p.num === 0) continue;
        const key = p.tex || '';
        if (!map.has(key)) {
            map.set(key, { num: p.num, den: p.den, tex: p.tex, factors: [...(p.factors || [])] });
        } else {
            const existing = map.get(key);
            const sum = fracAdd({ n: existing.num, d: existing.den }, { n: p.num, d: p.den });
            existing.num = sum.n;
            existing.den = sum.d;
        }
    }
    const res = [];
    for (let p of map.values()) {
        if (p.num !== 0) {
            res.push(createPart(p.num, p.den, p.tex, p.factors));
        }
    }
    return res;
}

function addParts(partsA, partsB) {
    return partsA.concat(partsB).filter(p => p.num !== 0);
}

function subParts(partsA, partsB) {
    const negB = partsB.map(p => createPart(-p.num, p.den, p.tex, p.factors));
    return partsA.concat(negB).filter(p => p.num !== 0);
}

// Polynomial Simplification Helpers
function fracParse(str) {
    if (!str) return { n: 0, d: 1 };
    if (typeof str === 'number') return { n: str, d: 1 };
    let parts = str.split('/');
    if (parts.length === 2) {
        let n = parseInt(parts[0]), d = parseInt(parts[1]);
        if (d < 0) { n = -n; d = -d; }
        let g = gcd(abs(n), abs(d));
        return { n: n / g, d: d / g };
    }
    return { n: parseInt(str), d: 1 };
}
function fracAdd(a, b) {
    let n = a.n * b.d + b.n * a.d;
    let d = a.d * b.d;
    if (d < 0) { n = -n; d = -d; }
    let g = gcd(abs(n), abs(d));
    return { n: n / g, d: d / g };
}
function fracSub(a, b) {
    return fracAdd(a, { n: -b.n, d: b.d });
}
function fracToStr(a) {
    if (a.n === 0) return '0';
    if (a.d === 1) return a.n.toString();
    return `${a.n}/${a.d}`;
}

// Polynomial Simplification Helpers
function getPolyPower(factors, v) {
    let k = { n: 0, d: 1 };
    for (let f of factors) {
        if (f === v) k = fracAdd(k, { n: 1, d: 1 });
        else if (f === `\\frac{1}{${v}}`) k = fracSub(k, { n: 1, d: 1 });
        else {
            let m = f.match(new RegExp(`^${v}\\^([0-9]+)$`));
            if (m) k = fracAdd(k, { n: parseInt(m[1]), d: 1 });
            else {
                m = f.match(new RegExp(`^${v}\\^\\{?([0-9-]+)\\}?$`));
                if (m) k = fracAdd(k, { n: parseInt(m[1]), d: 1 });
                else {
                    m = f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^([0-9]+)\\}$`));
                    if (m) k = fracSub(k, { n: parseInt(m[1]), d: 1 });
                    else {
                        m = f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^\\{?([0-9-]+)\\}?\\}$`));
                        if (m) k = fracSub(k, { n: parseInt(m[1]), d: 1 });
                        else {
                            m = f.match(new RegExp(`^${v}\\^\\{\\\\frac\\{([0-9-]+)\\}\\{([0-9]+)\\}\\}$`));
                            if (m) k = fracAdd(k, { n: parseInt(m[1]), d: parseInt(m[2]) });
                            else {
                                m = f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^\\{\\\\frac\\{([0-9-]+)\\}\\{([0-9]+)\\}\\}\\}$`));
                                if (m) k = fracSub(k, { n: parseInt(m[1]), d: parseInt(m[2]) });
                            }
                        }
                    }
                }
            }
        }
    }
    return fracToStr(k);
}

function formatPolyPower(kStr, v) {
    let k = fracParse(kStr);
    if (k.n === 0) return '';
    if (k.n === 1 && k.d === 1) return v;
    if (k.n === -1 && k.d === 1) return `\\frac{1}{${v}}`;
    
    if (k.d === 1) {
        return k.n < -1 ? `\\frac{1}{${v}^{${-k.n}}}` : `${v}^{${k.n}}`;
    } else {
        return k.n < 0 ? `\\frac{1}{${v}^{\\frac{${-k.n}}{${k.d}}}}` : `${v}^{\\frac{${k.n}}{${k.d}}}`;
    }
}

function combineLikeTerms(parts, v) {
    let map = {};
    for (let p of parts) {
        let kStr = getPolyPower(p.factors, v);
        if (!map[kStr]) map[kStr] = { num: 0, den: 1 };
        let a = map[kStr].num, b = map[kStr].den;
        let c = p.num, d = p.den;
        let top = a*d + c*b;
        let bot = b*d;
        let g = gcd(abs(top), abs(bot));
        map[kStr].num = top / g;
        map[kStr].den = bot / g;
    }
    let res = [];
    for (let kStr in map) {
        if (map[kStr].num !== 0) {
            let tex = formatPolyPower(kStr, v);
            res.push(createPart(map[kStr].num, map[kStr].den, tex, tex ? [tex] : []));
        }
    }
    return res.sort((a, b) => {
        let kA = fracParse(getPolyPower(a.factors, v));
        let kB = fracParse(getPolyPower(b.factors, v));
        return (kB.n/kB.d) - (kA.n/kA.d);
    });
}

function differentiatePolyParts(parts, v) {
    let dParts = [];
    for (let p of parts) {
        let kStr = getPolyPower(p.factors, v);
        let k = fracParse(kStr);
        if (k.n === 0) continue;
        let newNum = p.num * k.n;
        let newDen = p.den * k.d;
        if (newDen < 0) { newNum = -newNum; newDen = -newDen; }
        
        let newK = fracSub(k, {n: 1, d: 1});
        let newTex = formatPolyPower(fracToStr(newK), v);
        dParts.push(createPart(newNum, newDen, newTex, newTex ? [newTex] : []));
    }
    return combineLikeTerms(dParts, v);
}

function dividePolyParts(partsNum, denPart, v) {
    let res = [];
    let denK = fracParse(getPolyPower(denPart.factors, v));
    for (let p of partsNum) {
        let numK = fracParse(getPolyPower(p.factors, v));
        let newK = fracSub(numK, denK);
        let newNum = p.num * denPart.den;
        let newDen = p.den * denPart.num;
        if (newDen < 0) { newNum = -newNum; newDen = -newDen; }
        let tex = formatPolyPower(fracToStr(newK), v);
        res.push(createPart(newNum, newDen, tex, tex ? [tex] : []));
    }
    return res;
}

function checkPoly(parts, v) {
    return parts.every(p => p.factors.every(f => 
        f === v || f === `\\frac{1}{${v}}` ||
        f.match(new RegExp(`^${v}\\^\\{?([0-9-]+)\\}?$`)) ||
        f.match(new RegExp(`^${v}\\^([0-9]+)$`)) ||
        f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^([0-9]+)\\}$`)) ||
        f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^\\{?([0-9-]+)\\}?\\}$`)) ||
        f.match(new RegExp(`^${v}\\^\\{\\\\frac\\{([0-9-]+)\\}\\{([0-9]+)\\}\\}$`)) ||
        f.match(new RegExp(`^\\\\frac\\{1\\}\\{${v}\\^\\{\\\\frac\\{([0-9-]+)\\}\\{([0-9]+)\\}\\}\\}$`))
    ));
}


function partsToTex(parts) {
    if (parts.length === 0) return '0';
    let str = parts.map((p, i) => {
        let n = p.num, d = p.den;
        if (n === 0) return '';
        let sign = n < 0 ? '-' : '+';
        n = abs(n);
        
        let modifiedTex = p.tex;
        let extDen = '';
        
        if (modifiedTex.startsWith('\\frac{1}{')) {
            let depth = 0;
            let braceIdx = -1;
            let contentStart = 9; 
            for(let j = contentStart; j < modifiedTex.length; j++) {
                if (modifiedTex[j] === '{') depth++;
                else if (modifiedTex[j] === '}') {
                    if (depth === 0) { braceIdx = j; break; }
                    else depth--;
                }
            }
            if (braceIdx !== -1) {
                extDen = modifiedTex.substring(contentStart, braceIdx);
                modifiedTex = modifiedTex.substring(braceIdx + 1);
            }
        }
        
        let numStr;
        if (n !== 1 || modifiedTex === '') {
            if (n !== 1 && modifiedTex !== '' && /^[0-9]/.test(modifiedTex)) {
                numStr = `${n} \\cdot ${modifiedTex}`;
            } else {
                numStr = n + modifiedTex;
            }
        } else {
            numStr = modifiedTex;
        }
        let denStr = d !== 1 || extDen === '' ? (d === 1 ? '' : d) + extDen : extDen;
        
        let termTex = denStr === '' ? numStr : `\\frac{${numStr}}{${denStr}}`;
        
        if (termTex === '') termTex = '1';
        
        if (i === 0) {
            return sign === '-' ? '-' + termTex : termTex;
        } else {
            return sign === '-' ? ` - ${termTex}` : ` + ${termTex}`;
        }
    }).filter(x => x).join('');
    
    if (str) {
        str = str.replace(/\\frac\{([^}]*)\}\{([a-z])\}/g, (match, num, den) => {
            let m = num.match(new RegExp(`^([0-9-]*)${den}\\^\\{?(-?\\d+)\\}?$`));
            if (m) {
                let coeff = m[1];
                let p = parseInt(m[2]) - 1;
                let vStr = p === 0 ? '' : (p === 1 ? den : `${den}^{${p}}`);
                let res = coeff + vStr;
                if (res === '' || res === '-') res += '1';
                return res;
            }
            let m2 = num.match(new RegExp(`^([0-9-]*)${den}$`));
            if (m2) {
                let coeff = m2[1];
                let res = coeff;
                if (res === '' || res === '-') res += '1';
                return res;
            }
            return match;
        });
        
        str = str.replace(/\\sin\(([^)]+)\)\\sin\(\1\)/g, '\\sin^2($1)');
        str = str.replace(/\\cos\(([^)]+)\)\\cos\(\1\)/g, '\\cos^2($1)');
        str = str.replace(/\\sin\\left\((.+?)\\right\)\\sin\\left\(\1\\right\)/g, '\\sin^2\\left($1\\right)');
        str = str.replace(/\\cos\\left\((.+?)\\right\)\\cos\\left\(\1\\right\)/g, '\\cos^2\\left($1\\right)');
    }
    
    return str || '0';
}

function getTerm(v, diff, allowConst = true, forceCoeff1 = false) {
    const types = ['poly', 'exp', 'trig', 'log'];
    if (allowConst) types.push('const');
    
    const type = types[rnd(0, types.length - 1)];
    
    let expr, parts, dExpr, dParts, explanation;
    
    const formatVarPow = (varName, power) => {
        let pStr = String(power).trim();
        if (pStr === '0' || pStr === '') return '';
        if (pStr === '1') return varName;
        if (pStr === '-' || pStr === '-1') return `${varName}^{-1}`;
        return `${varName}^{${pStr}}`;
    };
    
    if (type === 'poly') {
        const a = forceCoeff1 ? 1 : (diff === 'easy' ? rnz(-3, 3) : rnz(-5, 5));
        const isFrac = (diff === 'medium' || diff === 'hard' || diff === 'very hard') && rnd(0, 2) === 0;
        let nStr, nTex, num, den, dNum, dDen, dTexExp;
        if (isFrac) {
            num = rnz(-4, 4);
            den = rnd(2, 4);
            let g1 = gcd(abs(num), den);
            num /= g1;
            den /= g1;
            
            if (den === 1) {
                nStr = `${num}`;
                nTex = `${num}`;
            } else {
                nStr = `${num}/${den}`;
                nTex = `\\frac{${num}}{${den}}`;
            }
            
            dNum = num - den;
            dDen = den;
            let g2 = gcd(abs(dNum), dDen);
            let dNumSimp = dNum / g2;
            let dDenSimp = dDen / g2;
            
            if (dDenSimp === 1) {
                dTexExp = `${dNumSimp}`;
            } else {
                dTexExp = `\\frac{${dNumSimp}}{${dDenSimp}}`;
            }
        } else {
            num = diff === 'easy' ? rnz(2, 4) : rnz(-5, 5);
            den = 1;
            nStr = `${num}`;
            nTex = `${num}`;
            dNum = num - 1;
            dDen = 1;
            dTexExp = `${dNum}`;
        }
        
        expr = `(${a}*${v}^(${nStr}))`;
        const baseTex = formatVarPow(v, nTex);
        parts = [createPart(a, 1, baseTex)];
        
        const dBaseTex = formatVarPow(v, dTexExp);
        dExpr = `(${a}*(${nStr})*${v}^(${dNum}/${dDen}))`;
        dParts = [createPart(a * num, den, dBaseTex)];
        
        let baseParts = [createPart(1, 1, baseTex)];
        let dBaseParts = [createPart(num, den, dBaseTex)];
        explanation = `Use Power Rule: $ \\frac{d}{d${v}}[${v}^n] = n${v}^{n-1} $. Derivative of $ ${partsToTex(parts)} $ is $ ${partsToTex(dParts)} $`;
        let baseExplanation = `Use Power Rule: $ \\frac{d}{d${v}}[${v}^n] = n${v}^{n-1} $. Derivative of $ ${partsToTex(baseParts)} $ is $ ${partsToTex(dBaseParts)} $`;
        
        return { expr, parts, dExpr, dParts, baseParts, dBaseParts, explanation, baseExplanation, isConst: false, type };
    }
    
    if (type === 'exp') {
        const a = forceCoeff1 ? 1 : (diff === 'easy' ? rnz(-3, 3) : rnz(-5, 5));
        const base = ((diff === 'hard' || diff === 'very hard') && rnd(0, 1) === 1) ? rnd(2, 5) : 'e';
        expr = `(${a}*${base}^${v})`;
        parts = [createPart(a, 1, `${base}^${v}`)];
        
        let baseParts = [createPart(1, 1, `${base}^${v}`)];
        let dBaseParts;
        if (base === 'e') {
            dExpr = expr;
            dParts = [createPart(a, 1, `e^${v}`)];
            dBaseParts = [createPart(1, 1, `e^${v}`)];
            explanation = `Derivative of $ ${partsToTex(parts)} $ is $ ${partsToTex(dParts)} $`;
        } else {
            dExpr = `(${a}*log(${base})*${base}^${v})`;
            dParts = [createPart(a, 1, `\\ln(${base})${base}^${v}`)];
            dBaseParts = [createPart(1, 1, `\\ln(${base})${base}^${v}`)];
            explanation = `Derivative of $ ${partsToTex(parts)} $ is $ ${partsToTex(dParts)} $`;
        }
        let baseExplanation = `Derivative of $ ${partsToTex(baseParts)} $ is $ ${partsToTex(dBaseParts)} $`;
        return { expr, parts, dExpr, dParts, baseParts, dBaseParts, explanation, baseExplanation, isConst: false, type };
    }
    
    if (type === 'trig') {
        const a = forceCoeff1 ? 1 : rnz(-5, 5);
        const isSin = rnd(0, 1) === 1;
        const trigTex = isSin ? `\\sin(${v})` : `\\cos(${v})`;
        const dTrigTex = isSin ? `\\cos(${v})` : `\\sin(${v})`; // handled sign in dParts
        
        expr = `(${a}*${isSin ? 'sin' : 'cos'}(${v}))`;
        parts = [createPart(a, 1, trigTex)];
        
        dExpr = `(${a}*${isSin ? 'cos' : '(-sin)'}(${v}))`;
        dParts = [createPart(isSin ? a : -a, 1, dTrigTex)];
        
        let baseParts = [createPart(1, 1, trigTex)];
        let dBaseParts = [createPart(isSin ? 1 : -1, 1, dTrigTex)];
        
        explanation = `Derivative of $ ${partsToTex(parts)} $ is $ ${partsToTex(dParts)} $`;
        let baseExplanation = `Derivative of $ ${partsToTex(baseParts)} $ is $ ${partsToTex(dBaseParts)} $`;
        return { expr, parts, dExpr, dParts, baseParts, dBaseParts, explanation, baseExplanation, isConst: false, type };
    }
    
    if (type === 'log') {
        const a = forceCoeff1 ? 1 : rnz(-5, 5);
        expr = `(${a}*log(${v}))`;
        parts = [createPart(a, 1, `\\ln(${v})`)];
        dExpr = `(${a}/${v})`;
        dParts = [createPart(a, 1, `\\frac{1}{${v}}`)];
        let baseParts = [createPart(1, 1, `\\ln(${v})`)];
        let dBaseParts = [createPart(1, 1, `\\frac{1}{${v}}`)];
        explanation = `Derivative of $ ${partsToTex(parts)} $ is $ ${partsToTex(dParts)} $`;
        let baseExplanation = `Derivative of $ ${partsToTex(baseParts)} $ is $ ${partsToTex(dBaseParts)} $`;
        return { expr, parts, dExpr, dParts, baseParts, dBaseParts, explanation, baseExplanation, isConst: false, type };
    }
    
    if (type === 'const') {
        const cTypes = ['pi', 'sqrt', 'e', 'int'];
        const cType = cTypes[rnd(0, cTypes.length - 1)];
        let cExpr, cTex;
        if (cType === 'pi') {
            const exp = rnd(2, 4);
            cExpr = `(pi^${exp})`; cTex = `\\pi^{${exp}}`;
        } else if (cType === 'sqrt') {
            const num = rnd(2, 20);
            cExpr = `(sqrt(${num}))`; cTex = `\\sqrt{${num}}`;
        } else if (cType === 'e') {
            const exp = rnd(2, 5);
            cExpr = `(e^${exp})`; cTex = `e^{${exp}}`;
        } else {
            const num = rnz(-10, 10);
            cExpr = `${num}`; cTex = `${num}`;
        }
        parts = [cType === 'int' ? createPart(Number(cExpr), 1, '') : createPart(1, 1, cTex)];
        dParts = [];
        return { 
            expr: cExpr, parts, dExpr: '0', dParts, 
            explanation: `Derivative of a constant ($ ${cTex} $) is $ 0 $.`, 
            isConst: true, type 
        };
    }
}

function isTooSimilar(u, w) {
    if (u.type === 'exp' && w.type === 'exp') return true;
    if (u.type === 'log' && w.type === 'log') return true;
    if (u.type === 'trig' && w.type === 'trig') {
        const uSin = u.parts[0].tex.includes('sin');
        const wSin = w.parts[0].tex.includes('sin');
        return uSin === wSin;
    }
    return false;
}

const generators = {
    basic: {
        generate: (v, diff) => {
            if (diff === 'very hard' && rnd(0, 2) === 0) {
                const isDiv = rnd(0, 1) === 1;
                if (isDiv) {
                    const a = rnz(-5, 5), b = rnz(-5, 5);
                    const n = rnd(3, 6), m = rnd(1, 2), k = rnd(1, 4);
                    const expr = `(${a}*${v}^${n} + ${b}*${v}^${m}) / (${v}^${k})`;
                    
                    const numParts = [
                        createPart(a, 1, formatPolyPower(n.toString(), v)),
                        createPart(b, 1, formatPolyPower(m.toString(), v))
                    ];
                    const denPart = createPart(1, 1, formatPolyPower(k.toString(), v));
                    const denTex = partsToTex([denPart]);
                    const tex = `\\frac{${partsToTex(numParts)}}{${denTex}}`;
                    
                    const t1Tex = `\\frac{${partsToTex([numParts[0]])}}{${denTex}}`;
                    const t2Num = createPart(abs(b), 1, formatPolyPower(m.toString(), v));
                    const t2Tex = `\\frac{${partsToTex([t2Num])}}{${denTex}}`;
                    const simpTex1 = `${t1Tex} ${b > 0 ? '+' : '-'} ${t2Tex}`;
                    
                    const simpParts = [
                        createPart(a, 1, formatPolyPower((n - k).toString(), v)),
                        createPart(b, 1, formatPolyPower((m - k).toString(), v))
                    ];
                    const simpTex2 = partsToTex(simpParts);
                    
                    const da = a * (n - k);
                    const db = b * (m - k);
                    let dParts = combineSameTex([
                        createPart(da, 1, formatPolyPower((n - k - 1).toString(), v)),
                        createPart(db, 1, formatPolyPower((m - k - 1).toString(), v))
                    ]);
                    
                    const steps = [
                        "Simplify the expression first by dividing each term by the denominator.",
                        `$ ${tex} = ${simpTex1} $`,
                        `$ = ${simpTex2} $`,
                        "Now apply the Power Rule to each term.",
                        `Final Answer: $ ${partsToTex(dParts)} $`
                    ];
                    return { expr, tex, dExpr: `(${da}*${v}^${n-k-1} + ${db}*${v}^${m-k-1})`, steps, rules: ['basic', 'quotient'] };
                }
            }
            
            let numTerms = 1;
            if (diff === 'medium') numTerms = 2;
            else if (diff === 'hard') numTerms = rnd(2, 3);
            else if (diff === 'very hard') numTerms = rnd(3, 4);
            
            const terms = [];
            for (let i = 0; i < numTerms; i++) {
                terms.push(getTerm(v, diff, i > 0 && diff !== 'easy')); // only allow const if not first term and not easy
            }
            
            const expr = terms.map(t => t.expr).join(' + ');
            let allParts = [];
            terms.forEach(t => allParts = addParts(allParts, t.parts));
            const tex = partsToTex(allParts);
            
            const dExpr = terms.map(t => t.dExpr).join(' + ');
            let allDParts = [];
            terms.filter(t => !t.isConst).forEach(t => allDParts = addParts(allDParts, t.dParts));
            
            let steps = [];
            if (numTerms > 1) {
                steps.push("Use the Sum and Difference Rules to differentiate term by term.");
                steps.push(...terms.filter(t => !t.isConst).map((t, i) => `Term ${i+1}: ${t.explanation}`));
            } else {
                let t = terms[0];
                let num = abs(t.parts[0].num);
                let den = t.parts[0].den;
                if (num !== 1 || den !== 1) {
                    let cTex = partsToTex([createPart(t.parts[0].num, t.parts[0].den, '')]);
                    steps.push("Use the Constant Multiple Rule to leave the constant factor outside the derivative.");
                    steps.push(t.baseExplanation);
                    steps.push(`Multiply the constant back: $ ${cTex} \\cdot \\left(${partsToTex(t.dBaseParts)}\\right) = ${partsToTex(t.dParts)} $`);
                } else {
                    steps.push(t.explanation);
                }
            }
            steps.push(`Final Answer: $ ${partsToTex(allDParts)} $`);
            
            return { expr, tex, dExpr, steps };
        }
    },
    product: {
        generate: (v, diff) => {
            if (diff === 'very hard' && rnd(0, 2) === 0) {
                // Product of 3
                let u1 = getTerm(v, diff, false);
                let u2 = getTerm(v, diff, false, true);
                while (isTooSimilar(u1, u2)) u2 = getTerm(v, diff, false, true);
                let u3 = getTerm(v, diff, false, true);
                while (isTooSimilar(u1, u3) || isTooSimilar(u2, u3)) u3 = getTerm(v, diff, false, true);
                
                const expr = `(${u1.expr}) * (${u2.expr}) * (${u3.expr})`;
                const tex = `\\left(${partsToTex(u1.parts)}\\right) \\left(${partsToTex(u2.parts)}\\right) \\left(${partsToTex(u3.parts)}\\right)`;
                const dExpr = `(${u1.dExpr})*(${u2.expr})*(${u3.expr}) + (${u1.expr})*(${u2.dExpr})*(${u3.expr}) + (${u1.expr})*(${u2.expr})*(${u3.dExpr})`;
                
                let u1Poly = checkPoly(u1.parts, v);
                let u2Poly = checkPoly(u2.parts, v);
                let u3Poly = checkPoly(u3.parts, v);
                if (u1Poly && u2Poly && u3Poly) {
                    let p = multiplyParts(u1.parts, u2.parts);
                    let simplifiedParts = combineLikeTerms(multiplyParts(p, u3.parts), v);
                    let simplifiedTex = partsToTex(simplifiedParts);
                    let allDParts = differentiatePolyParts(simplifiedParts, v);
                    const steps = [
                        `Since all factors are polynomials, simplify the expression first by multiplying.`,
                        `$ ${tex} = ${simplifiedTex} $`,
                        `Now, apply the Power Rule term by term.`,
                        `Final Answer: $ ${partsToTex(allDParts)} $`
                    ];
                    return { expr, tex, dExpr, steps, rules: ['product', 'basic'] };
                }
                
                let p1 = multiplyParts(multiplyParts(u1.dParts, u2.parts), u3.parts);
                let p2 = multiplyParts(multiplyParts(u1.parts, u2.dParts), u3.parts);
                let p3 = multiplyParts(multiplyParts(u1.parts, u2.parts), u3.dParts);
                let allDParts = combineSameTex(addParts(addParts(p1, p2), p3));
                
                const steps = [
                    "Use the generalized Product Rule for three functions: $(uvw)' = u'vw + uv'w + uvw'$",
                    `Find derivatives of each part:`,
                    `$ (${partsToTex(u1.parts)})' = ${partsToTex(u1.dParts)} $`,
                    `$ (${partsToTex(u2.parts)})' = ${partsToTex(u2.dParts)} $`,
                    `$ (${partsToTex(u3.parts)})' = ${partsToTex(u3.dParts)} $`,
                    `Substitute into the formula: $ \\left(${partsToTex(u1.dParts)}\\right)\\left(${partsToTex(u2.parts)}\\right)\\left(${partsToTex(u3.parts)}\\right) + \\left(${partsToTex(u1.parts)}\\right)\\left(${partsToTex(u2.dParts)}\\right)\\left(${partsToTex(u3.parts)}\\right) + \\left(${partsToTex(u1.parts)}\\right)\\left(${partsToTex(u2.parts)}\\right)\\left(${partsToTex(u3.dParts)}\\right) $`,
                    `Final Answer (Combine and Simplify): $ ${partsToTex(allDParts)} $`
                ];
                return { expr, tex, dExpr, steps };
            }
            
            let u = getTerm(v, diff, false);
            let w = getTerm(v, diff, false, true);
            while (isTooSimilar(u, w)) w = getTerm(v, diff, false, true);
            
            let uExpr = u.expr, uParts = u.parts, duExpr = u.dExpr, duParts = u.dParts;
            let wExpr = w.expr, wParts = w.parts, dwExpr = w.dExpr, dwParts = w.dParts;
            
            if ((diff === 'hard' || diff === 'very hard') && rnd(0, 1) === 1) {
                const u2 = getTerm(v, diff, true);
                uExpr = `(${u.expr} + ${u2.expr})`;
                uParts = addParts(u.parts, u2.parts);
                duExpr = `(${u.dExpr} + ${u2.dExpr})`;
                duParts = addParts(u.dParts, u2.dParts);
            }
            
            const expr = `(${uExpr}) * (${wExpr})`;
            const tex = `\\left(${partsToTex(uParts)}\\right) \\left(${partsToTex(wParts)}\\right)`;
            const dExpr = `(${duExpr})*(${wExpr}) + (${uExpr})*(${dwExpr})`;
            
            let uPoly = checkPoly(uParts, v);
            let wPoly = checkPoly(wParts, v);
            if (uPoly && wPoly) {
                let simplifiedParts = combineLikeTerms(multiplyParts(uParts, wParts), v);
                let simplifiedTex = partsToTex(simplifiedParts);
                let allDParts = differentiatePolyParts(simplifiedParts, v);
                const steps = [
                    `Since both factors are polynomials, it is easier to simplify the expression first by multiplying.`,
                    `$ ${tex} = ${simplifiedTex} $`,
                    `Now, apply the Power Rule term by term.`,
                    `Final Answer: $ ${partsToTex(allDParts)} $`
                ];
                return { expr, tex, dExpr, steps, rules: ['product', 'basic'] };
            }
            
            let term1 = multiplyParts(duParts, wParts);
            let term2 = multiplyParts(uParts, dwParts);
            let allDParts = combineSameTex(addParts(term1, term2));
            
            const steps = [
                `Use the Product Rule: $ \\frac{d}{d${v}}[A \\cdot B] = A'B + AB' $`,
                `Identify $ A = ${partsToTex(uParts)} $ and $ B = ${partsToTex(wParts)} $`,
                `Find derivatives: $ A' = ${partsToTex(duParts)} $ and $ B' = ${partsToTex(dwParts)} $`,
                `Substitute into the formula: $ \\left(${partsToTex(duParts)}\\right)\\left(${partsToTex(wParts)}\\right) + \\left(${partsToTex(uParts)}\\right)\\left(${partsToTex(dwParts)}\\right) $`,
                `Final Answer (Combine and Simplify): $ ${partsToTex(allDParts)} $`
            ];
            
            return { expr, tex, dExpr, steps };
        }
    },
    quotient: {
        generate: (v, diff) => {
            let u = getTerm(v, diff, false);
            let w = getTerm(v, diff, false, true);
            while (isTooSimilar(u, w)) w = getTerm(v, diff, false, true);
            
            let uExpr = u.expr, uParts = u.parts, duExpr = u.dExpr, duParts = u.dParts;
            let wExpr = w.expr, wParts = w.parts, dwExpr = w.dExpr, dwParts = w.dParts;
            
            if (diff === 'hard' || diff === 'very hard') {
                const u2 = getTerm(v, diff, true);
                uExpr = `(${u.expr} + ${u2.expr})`;
                uParts = addParts(u.parts, u2.parts);
                duExpr = `(${u.dExpr} + ${u2.dExpr})`;
                duParts = addParts(u.dParts, u2.dParts);
                
                if (diff === 'very hard') {
                    const w2 = getTerm(v, diff, true, true);
                    wExpr = `(${w.expr} + ${w2.expr})`;
                    wParts = addParts(w.parts, w2.parts);
                    dwExpr = `(${w.dExpr} + ${w2.dExpr})`;
                    dwParts = addParts(w.dParts, w2.dParts);
                }
            }
            if (uParts.length > 0 && wParts.length > 0 && uParts[0].num < 0 && wParts[0].num < 0) {
                uParts = uParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                wParts = wParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                duParts = duParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                dwParts = dwParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                
                uExpr = `-(${uExpr})`;
                wExpr = `-(${wExpr})`;
                duExpr = `-(${duExpr})`;
                dwExpr = `-(${dwExpr})`;
            }
            
            const expr = `(${uExpr}) / (${wExpr})`;
            const tex = `\\frac{${partsToTex(uParts)}}{${partsToTex(wParts)}}`;
            const dExpr = `((${duExpr})*(${wExpr}) - (${uExpr})*(${dwExpr})) / ((${wExpr})^2)`;
            
            let uPoly = checkPoly(uParts, v);
            let wPoly = checkPoly(wParts, v);
            if (uPoly && wPoly && wParts.length === 1) {
                let simplifiedParts = combineLikeTerms(dividePolyParts(uParts, wParts[0], v), v);
                let simplifiedTex = partsToTex(simplifiedParts);
                let allDParts = differentiatePolyParts(simplifiedParts, v);
                const steps = [
                    `Since the numerator and denominator are both polynomials and the denominator is a single term, simplify the expression first by dividing each term.`,
                    `$ ${tex} = ${simplifiedTex} $`,
                    `Now, apply the Power Rule term by term.`,
                    `Final Answer: $ ${partsToTex(allDParts)} $`
                ];
                return { expr, tex, dExpr, steps, rules: ['quotient', 'basic'] };
            }
            
            let hiDLo = multiplyParts(duParts, wParts);
            let loDHi = multiplyParts(uParts, dwParts);
            let numParts = subParts(hiDLo, loDHi);
            let numTex = partsToTex(numParts);
            let wTex = partsToTex(wParts);
            let denTex = `\\left(${wTex}\\right)^2`;
            let finalNumTex = numTex;
            
            if (wParts.length === 1 && wParts[0].factors.length === 1) {
                let f = wParts[0].factors[0];
                let numSq = wParts[0].num * wParts[0].num;
                let denSq = wParts[0].den * wParts[0].den;
                
                let newNumParts = numParts.map(p => createPart(p.num * denSq, p.den, p.tex, p.factors));
                let newDenNum = numSq;
                
                let lcmDen = 1;
                for (let p of newNumParts) {
                    lcmDen = (lcmDen * p.den) / gcd(lcmDen, p.den);
                }
                
                newNumParts = newNumParts.map(p => createPart(p.num * (lcmDen / p.den), 1, p.tex, p.factors));
                newDenNum *= lcmDen;
                
                let overallGcd = abs(newDenNum);
                for (let p of newNumParts) {
                    overallGcd = gcd(overallGcd, abs(p.num));
                }
                
                newNumParts = newNumParts.map(p => createPart(p.num / overallGcd, 1, p.tex, p.factors));
                newDenNum /= overallGcd;
                
                finalNumTex = partsToTex(newNumParts);
                
                let coeffSq = newDenNum === 1 ? '' : newDenNum;
                
                let distributedTex = null;
                if (f === `e^${v}`) distributedTex = `${coeffSq}e^{2${v}}`;
                else if (f === `\\sin(${v})`) distributedTex = `${coeffSq}\\sin^2(${v})`;
                else if (f === `\\cos(${v})`) distributedTex = `${coeffSq}\\cos^2(${v})`;
                else if (f === `\\ln(${v})`) distributedTex = `${coeffSq}\\ln^2(${v})`;
                else if (f === v) distributedTex = `${coeffSq}${v}^2`;
                else {
                    let m = f.match(new RegExp(`^${v}\\^\\{?([0-9-]+)\\}?$`));
                    if (m) distributedTex = `${coeffSq}${v}^{${parseInt(m[1])*2}}`;
                    else {
                        m = f.match(/^([0-9]+)\^([a-z])$/);
                        if (m) {
                            let sep = coeffSq !== '' && /^[0-9]/.test(m[1]) ? ' \\cdot ' : '';
                            distributedTex = `${coeffSq}${sep}${m[1]}^{2${m[2]}}`;
                        }
                        else {
                            m = f.match(new RegExp(`^${v}\\^\\{\\\\frac\\{([0-9-]+)\\}\\{([0-9]+)\\}\\}$`));
                            if (m) {
                                let n = parseInt(m[1]) * 2;
                                let d = parseInt(m[2]);
                                let g = gcd(abs(n), d);
                                n /= g; d /= g;
                                if (d === 1) distributedTex = `${coeffSq}${n === 1 ? v : `${v}^{${n}}`}`;
                                else distributedTex = `${coeffSq}${v}^{\\frac{${n}}{${d}}}`;
                            }
                        }
                    }
                }
                
                if (distributedTex !== null) {
                    denTex = distributedTex === '' ? '1' : distributedTex;
                }
            }
            
            const steps = [
                `Use the Quotient Rule: $ \\frac{d}{d${v}}\\left[\\frac{\\text{Hi}}{\\text{Lo}}\\right] = \\frac{\\text{dHi} \\cdot \\text{Lo} - \\text{Hi} \\cdot \\text{dLo}}{\\text{Lo}^2} $`,
                `Identify numerator $ \\text{Hi} = ${partsToTex(uParts)} $ and denominator $ \\text{Lo} = ${partsToTex(wParts)} $`,
                `Find derivatives: $ \\text{dHi} = ${partsToTex(duParts)} $ and $ \\text{dLo} = ${partsToTex(dwParts)} $`,
                `Combine the numerator: $ \\text{dHi}\\cdot\\text{Lo} - \\text{Hi}\\cdot\\text{dLo} = ${numTex} $`,
                `Combine the unsimplified numerator and denominator: $ \\frac{${numTex}}{\\left(${wTex}\\right)^2} $`,
                `Final Answer: $ ${denTex === '1' ? finalNumTex : `\\frac{${finalNumTex}}{${denTex}}`} $`
            ];
            
            return { expr, tex, dExpr, steps };
        }
    },
    chain: {
        generate: (v, diff) => {
            const inner = getTerm(v, diff, false);
            let innerExpr = inner.expr, innerParts = inner.parts, dInnerExpr = inner.dExpr, dInnerParts = inner.dParts;
            
            if ((diff === 'hard' || diff === 'very hard') && rnd(0, 1) === 1) {
                const inner2 = getTerm(v, diff, true);
                innerExpr = `(${inner.expr} + ${inner2.expr})`;
                innerParts = addParts(inner.parts, inner2.parts);
                dInnerExpr = `(${inner.dExpr} + ${inner2.dExpr})`;
                dInnerParts = addParts(inner.dParts, inner2.dParts);
            }
            
            let outerTypes = ['power', 'exp', 'trig', 'log'];
            if (innerParts.length === 1) {
                if (checkPoly(innerParts, v) || inner.type === 'exp') {
                    outerTypes = ['exp', 'trig', 'log']; // Prevent (-t^3)^2 or (-2e^y)^2 from being generated
                }
            }
            
            // Check that inner expression is positive at one or more test points before keeping log
            const testPts = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
            let innerHasPositive = false;
            try {
                const compiledInner = math.compile(innerExpr);
                for (let pt of testPts) {
                    try {
                        const val = compiledInner.evaluate({ [v]: pt });
                        if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val > 0) {
                            innerHasPositive = true;
                            break;
                        }
                    } catch(e) {}
                }
            } catch(e) {}
            if (!innerHasPositive) {
                outerTypes = outerTypes.filter(t => t !== 'log');
                if (outerTypes.length === 0) outerTypes = ['exp'];
            }
            
            const oType = outerTypes[rnd(0, outerTypes.length - 1)];
            
            let expr, tex, dExpr, dOuterParts;
            
            if (oType === 'power') {
                const n = diff === 'easy' ? rnd(2, 3) : rnd(2, 5);
                expr = `(${innerExpr})^${n}`;
                tex = `\\left(${partsToTex(innerParts)}\\right)^{${n}}`;
                let innerP = `\\left(${partsToTex(innerParts)}\\right)`;
                let dOuterTex = (n - 1 === 1) ? innerP : `${innerP}^{${n-1}}`;
                if (n - 1 === 1 && innerParts.length === 1) {
                    dOuterParts = innerParts.map(p => createPart(n * p.num, p.den, p.tex, p.factors));
                } else {
                    dOuterParts = [createPart(n, 1, dOuterTex)];
                }
                dExpr = `(${n}*(${innerExpr})^${n-1} * (${dInnerExpr}))`;
            } else if (oType === 'exp') {
                const base = ((diff === 'hard' || diff === 'very hard') && rnd(0, 1) === 1) ? rnd(2, 5) : 'e';
                expr = `(${base}^(${innerExpr}))`;
                tex = `${base}^{\\left(${partsToTex(innerParts)}\\right)}`;
                if (base === 'e') {
                    dOuterParts = [createPart(1, 1, `e^{\\left(${partsToTex(innerParts)}\\right)}`)];
                    dExpr = `(e^(${innerExpr}) * (${dInnerExpr}))`;
                } else {
                    dOuterParts = [createPart(1, 1, `\\ln(${base})${base}^{\\left(${partsToTex(innerParts)}\\right)}`)];
                    dExpr = `(log(${base})*${base}^(${innerExpr}) * (${dInnerExpr}))`;
                }
            } else if (oType === 'trig') {
                const isSin = rnd(0, 1) === 1;
                const trig = isSin ? 'sin' : 'cos';
                const dTrig = isSin ? '\\cos' : '\\sin';
                expr = `${trig}(${innerExpr})`;
                tex = `\\${trig}\\left(${partsToTex(innerParts)}\\right)`;
                dOuterParts = [createPart(isSin ? 1 : -1, 1, `${dTrig}\\left(${partsToTex(innerParts)}\\right)`)];
                dExpr = `(${isSin ? 'cos' : '-sin'}(${innerExpr}) * (${dInnerExpr}))`;
            } else {
                expr = `log(${innerExpr})`;
                tex = `\\ln\\left(${partsToTex(innerParts)}\\right)`;
                dOuterParts = [createPart(1, 1, `\\frac{1}{${partsToTex(innerParts)}}`)];
                dExpr = `(1/(${innerExpr}) * (${dInnerExpr}))`;
            }
            
            const steps = [
                `Use the Chain Rule: $ \\frac{d}{d${v}}[f(u)] = f'(u) \\cdot u' $`,
                `The inner function is $ u = ${partsToTex(innerParts)} $`,
                `Its derivative is $ u' = ${partsToTex(dInnerParts)} $`,
                `The derivative of the outer function, leaving the inner function alone, is $ ${partsToTex(dOuterParts)} $`
            ];
            
            let allDParts;
            if (oType === 'log') {
                let iParts = innerParts;
                let diParts = dInnerParts;
                
                // Fix double negatives when combining into a fraction
                if (iParts.length > 0 && diParts.length > 0 && iParts[0].num < 0 && diParts[0].num < 0) {
                    iParts = iParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                    diParts = diParts.map(p => createPart(-p.num, p.den, p.tex, p.factors));
                }
                
                const innerTex = partsToTex(iParts);
                const dInnerTex = partsToTex(diParts);
                
                steps.push(`Substitute into the Chain Rule $ f'(u) \\cdot u' $: $ \\left(\\frac{1}{${partsToTex(innerParts)}}\\right) \\cdot \\left(${partsToTex(dInnerParts)}\\right) $`);
                
                let uPoly = checkPoly(iParts, v) && iParts.length === 1;
                let duPoly = checkPoly(diParts, v);
                if (uPoly && duPoly) {
                    allDParts = combineLikeTerms(dividePolyParts(diParts, iParts[0], v), v);
                } else {
                    if (innerTex === dInnerTex) {
                        steps.push(`Combine terms: $ \\frac{${dInnerTex}}{${innerTex}} $`);
                        allDParts = [createPart(1, 1, '')];
                    } else {
                        allDParts = [createPart(1, 1, `\\frac{${dInnerTex}}{${innerTex}}`)];
                    }
                }
            } else {
                steps.push(`Substitute into the Chain Rule $ f'(u) \\cdot u' $: $ \\left(${partsToTex(dOuterParts)}\\right)\\left(${partsToTex(dInnerParts)}\\right) $`);
                allDParts = multiplyParts(dOuterParts, dInnerParts);
            }
            
            steps.push(`Final Answer (Combine and Simplify): $ ${partsToTex(allDParts)} $`);
            
            return { expr, tex, dExpr, steps };
        }
    }
};

function getCorrectTex(steps, expr, v) {
    if (steps && steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const match = lastStep.match(/\$([^\$]+)\$/);
        if (match) return match[1].trim();
    }
    try {
        return math.derivative(expr, v).toTex();
    } catch(e) {
        return '0';
    }
}

function createDistractorFromError(tex, variant = 0) {
    if (!tex) return null;
    let dist = tex;
    if (variant === 0) {
        if (dist.includes(' + ')) {
            dist = dist.replace(' + ', ' - ');
        } else if (dist.includes(' - ')) {
            dist = dist.replace(' - ', ' + ');
        } else if (dist.startsWith('-')) {
            dist = dist.substring(1).trim();
        } else {
            dist = '-' + dist;
        }
    } else if (variant === 1) {
        if (dist.includes('\\sin') && !dist.includes('\\cos')) {
            dist = dist.replace(/\\sin/g, '\\cos');
        } else if (dist.includes('\\cos') && !dist.includes('\\sin')) {
            dist = dist.replace(/\\cos/g, '\\sin');
        } else if (/\b([2-9])\b/.test(dist)) {
            dist = dist.replace(/\b([2-9])\b/, (m) => String(parseInt(m, 10) + 1));
        } else if (/\^\{?([2-9])\}?/.test(dist)) {
            dist = dist.replace(/\^\{?([2-9])\}?/, (m, p) => `^{${parseInt(p, 10) + 1}}`);
        } else {
            dist = dist.startsWith('-') ? dist.substring(1).trim() : '-' + dist;
        }
    } else {
        if (dist.includes('^2')) {
            dist = dist.replace('^2', '');
        } else if (/\^\{?([2-9])\}?/.test(dist)) {
            dist = dist.replace(/\^\{?([2-9])\}?/, (m, p) => `^{${Math.max(1, parseInt(p, 10) - 1)}}`);
        } else if (dist.includes('+')) {
            dist = dist.replace('+', '-');
        } else {
            dist = `2 \\left(${dist}\\right)`;
        }
    }
    return (dist !== tex) ? dist : null;
}

function generateDistractors(rule, varName, difficulty, correctTex, count = 4) {
    const list = new Set();
    
    // 1. Try targeted calculus variations
    for (let variant = 0; variant < 4; variant++) {
        const errTex = createDistractorFromError(correctTex, variant);
        if (errTex && errTex !== correctTex && !list.has(errTex)) {
            list.add(errTex);
        }
    }
    
    // 2. Sibling problem derivatives
    let retries = 15;
    while (list.size < count && retries-- > 0) {
        try {
            const siblingGen = generators[rule].generate(varName, difficulty);
            if (siblingGen && siblingGen.steps && siblingGen.steps.length > 0) {
                const lastStep = siblingGen.steps[siblingGen.steps.length - 1];
                const match = lastStep.match(/\$([^\$]+)\$/);
                if (match) {
                    const sibTex = match[1].trim();
                    if (sibTex !== correctTex && !list.has(sibTex)) {
                        list.add(sibTex);
                    }
                }
            }
        } catch(e) {}
    }
    
    // 3. Fallback if still under count
    let mult = 2;
    while (list.size < count) {
        const fb = `${mult} \\left(${correctTex}\\right)`;
        if (!list.has(fb) && fb !== correctTex) {
            list.add(fb);
        }
        mult++;
    }
    
    return Array.from(list).slice(0, count);
}

function generateQuizOptions(rule, varName, difficulty, correctTex) {
    // 20% to 25% of the time, "None of the above" (E) is the correct answer
    const isNoneCorrect = (rnd(0, 3) === 0);
    const distractors = generateDistractors(rule, varName, difficulty, correctTex, 4);
    
    let options = [];
    let correctOptionId = 'E';
    
    if (isNoneCorrect) {
        options = [
            { id: 'A', text: distractors[0], isNone: false },
            { id: 'B', text: distractors[1], isNone: false },
            { id: 'C', text: distractors[2], isNone: false },
            { id: 'D', text: distractors[3], isNone: false },
            { id: 'E', text: 'None of the above', isNone: true }
        ];
        correctOptionId = 'E';
    } else {
        const letters = ['A', 'B', 'C', 'D'];
        const correctLetter = letters[rnd(0, 3)];
        let dIdx = 0;
        
        for (let l of letters) {
            if (l === correctLetter) {
                options.push({ id: l, text: correctTex, isNone: false });
            } else {
                options.push({ id: l, text: distractors[dIdx++], isNone: false });
            }
        }
        options.push({ id: 'E', text: 'None of the above', isNone: true });
        correctOptionId = correctLetter;
    }
    
    return {
        options,
        correctOptionId,
        isNoneCorrect,
        correctTex
    };
}

function generateProblem(retries = 20) {
    if (retries <= 0) {
        return {
            expr: '0',
            tex: '\\text{Error generating problem. Please click Next Problem.}',
            steps: [],
            correctExpr: '0',
            correctTex: '0',
            varName: 'x',
            rule: 'basic',
            quizData: {
                options: [
                    { id: 'A', text: '0', isNone: false },
                    { id: 'B', text: '1', isNone: false },
                    { id: 'C', text: '-1', isNone: false },
                    { id: 'D', text: '2', isNone: false },
                    { id: 'E', text: 'None of the above', isNone: true }
                ],
                correctOptionId: 'A',
                isNoneCorrect: false,
                correctTex: '0'
            }
        };
    }
    const activeRules = Object.keys(state.rules).filter(r => state.rules[r]);
    if (activeRules.length === 0) return null;
    
    const rule = activeRules[rnd(0, activeRules.length - 1)];
    const v = getVar();
    const notation = getNotation(v);
    

    
    let gen;
    try {
        gen = generators[rule].generate(v, state.difficulty);
    } catch(e) {
        console.error("Generator error", e);
        return generateProblem(retries - 1);
    }
    
    const { expr, tex, steps } = gen;
    
    let correctDerivativeNode;
    try {
        correctDerivativeNode = math.derivative(expr, v);
    } catch(e) {
        console.error("Failed to differentiate", expr, e);
        return generateProblem(retries - 1);
    }
    
    let displayTex;
    if (state.mode === 'ruleIdentification') {
        if (notation.type === 'd') {
            displayTex = `\\text{For } ${notation.str}\\left[ ${tex} \\right]\\text{, which rule does this need?}`;
        } else {
            displayTex = `\\text{If } ${notation.str} = ${tex}\\text{, which rule does this need?}`;
        }
    } else {
        if (notation.type === 'd') {
            displayTex = `${notation.str}\\left[ ${tex} \\right]`;
        } else {
            displayTex = `\\text{If } ${notation.str} = ${tex}\\text{, what is } ${notation.derivStr}\\text{?}`;
        }
    }
    
    const correctTex = getCorrectTex(steps, expr, v);
    
    const prob = {
        expr,
        tex: displayTex,
        steps,
        correctExpr: correctDerivativeNode.toString(),
        correctTex,
        varName: v,
        rule,
        rules: gen.rules || [rule]
    };
    prob.quizData = generateQuizOptions(rule, v, state.difficulty, correctTex);
    return prob;
}

// Answer Normalization & Equivalence Checking
function normalizeAnswer(s, varName) {
    if (!s) return '';
    let str = s.toLowerCase().trim();
    
    // Strip leading "dy/dx =", "y' =", "f'(x) =", "d/dx [...] =" prefix
    str = str.replace(/^(?:d[a-z]\/d[a-z]|[a-z]'\([a-z]\)|[a-z]'|[a-z]\([a-z]\))\s*=\s*/i, '');
    if (str.includes('=')) {
        str = str.split('=').pop().trim();
    }
    
    // Strip LaTeX left/right delimiters
    str = str.replace(/\\left|\\right/g, '');
    
    // Replace \cdot with *
    str = str.replace(/\\cdot/g, '*');
    
    // Convert LaTeX fractions \frac{a}{b} -> ((a)/(b))
    str = str.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))');
    
    // Convert LaTeX square roots \sqrt{a} -> sqrt(a)
    str = str.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');
    
    // Convert curly brace exponents x^{2} -> x^(2)
    str = str.replace(/\^\{([^}]+)\}/g, '^($1)');
    
    // Convert square brackets [ ... ] to parentheses ( ... )
    str = str.replace(/\[/g, '(').replace(/\]/g, ')');
    
    // Strip leading backslashes on standard math functions and constants
    str = str.replace(/\\(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|pi)/g, '$1');
    
    // Replace ln with log
    str = str.replace(/\bln\b/g, 'log');
    
    // Convert sin^2(x) -> sin(x)^2, etc.
    str = str.replace(/\b(sin|cos|tan|sec|csc|cot)\^([0-9]+)\s*\(([^)]+)\)/g, '$1($3)^$2');
    str = str.replace(/\b(sin|cos|tan|sec|csc|cot)\^([0-9]+)\s*([a-z0-9]+)/g, '$1($3)^$2');
    
    // Convert "cos x" -> "cos(x)"
    str = str.replace(/\b(sin|cos|tan|sec|csc|cot|log|exp)\s+([a-z0-9]+)/g, '$1($2)');
    
    // Insert * between a number, a single variable or ) and a following function name, e^ or (
    str = str.replace(/([0-9\)]|\b[a-z]\b)\s*(sin|cos|tan|sec|csc|cot|log|exp)\b/g, '$1*$2');
    str = str.replace(/([0-9\)]|\b[a-z]\b)\s*(e\^)/g, '$1*$2');
    str = str.replace(/([0-9\)]|\b[a-z]\b)\s*\(/g, '$1*(');
    
    // Insert * after ) before a letter or digit
    str = str.replace(/\)\s*([0-9a-z])/g, ')*$1');
    
    // Insert * between number and letter: e.g. 2x -> 2*x
    str = str.replace(/([0-9])\s*([a-z])/g, '$1*$2');
    
    return str;
}

function checkEquivalence(userExprStr, correctExprStr, varName) {
    const normalizedUser = normalizeAnswer(userExprStr, varName);
    let userNode;
    try {
        userNode = math.parse(normalizedUser);
    } catch (e) {
        return { isCorrect: false, error: 'parse_error' };
    }
    
    try {
        const correctNode = math.parse(correctExprStr);
        
        const userCode = userNode.compile();
        const correctCode = correctNode.compile();
        
        const testPoints = [0.1, 0.3, 0.5, 0.7, 1.23, 2.71, 3.14];
        let usablePoints = 0;
        
        for (let x of testPoints) {
            const scope = { [varName]: x };
            let uVal, cVal;
            try {
                cVal = correctCode.evaluate(scope);
                uVal = userCode.evaluate(scope);
            } catch(e) {
                continue;
            }
            
            // Skip point if correct value is not finite or is NaN
            if (typeof cVal !== 'number' || isNaN(cVal) || !isFinite(cVal)) {
                continue;
            }
            
            // If user's value is NaN or not finite, fail immediately
            if (typeof uVal !== 'number' || isNaN(uVal) || !isFinite(uVal)) {
                return { isCorrect: false };
            }
            
            // Relative error comparison: Math.abs(u - c) <= 1e-6 * Math.max(1, Math.abs(c))
            const diff = Math.abs(uVal - cVal);
            const tol = 1e-6 * Math.max(1, Math.abs(cVal));
            if (diff > tol) {
                return { isCorrect: false };
            }
            usablePoints++;
        }
        
        if (usablePoints < 3) {
            return { isCorrect: false, error: 'eval_error' };
        }
        
        return { isCorrect: true };
    } catch(e) {
        return { isCorrect: false, error: 'eval_error' };
    }
}



// UI Rendering
function render() {
    const existingInput = document.getElementById('answer-input');
    if (existingInput && !state.waitingForNext) {
        state.currentInput = existingInput.value;
    }
    
    let hearts = '';
    if (state.mode === 'survival') {
        hearts = '❤️'.repeat(state.lives) + '🖤'.repeat(3 - state.lives);
    }

    const xpNeeded = getXpForLevel(state.level);
    const xpPercent = Math.min(100, Math.floor((state.xp / xpNeeded) * 100));

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="header fade-in" style="margin-top: 1rem;">
            <h1>Derivative Practice</h1>
            <p>Master your calculus skills</p>
        </div>
        
        <div class="score-board fade-in">
            <div>Score: <span class="stats-value">${state.score}</span></div>
            <div>Streak: <span class="stats-value">${state.streak}</span></div>
            ${state.mode === 'survival' ? `<div>Lives: <span class="stats-value">${hearts}</span></div>` : ''}
            ${state.timerActive ? `<div>Time: <span class="stats-value" id="timer-display">${Math.floor(state.timeLeft / 60)}:${(state.timeLeft % 60).toString().padStart(2, '0')}</span></div>` : ''}
        </div>
        
        <div class="stats-board fade-in" style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 1.5rem; color: #94a3b8; font-size: 0.9rem;">
            <div>High Score: <span style="color: #cbd5e1">${state.highScore}</span></div>
            ${state.mode === 'timeAttack' ? `<div>Time Attack Max: <span style="color: #cbd5e1">${state.taHighScore}</span></div>` : ''}
            <div>Max Streak: <span style="color: #cbd5e1">${state.maxStreak}</span></div>
        </div>
        
        ${state.mode === 'career' ? `
        <div class="xp-bar-container">
            <div class="xp-bar-fill" style="width: ${xpPercent}%"></div>
            <div class="xp-bar-text">Level ${state.level} - ${state.xp}/${xpNeeded} XP</div>
        </div>
        ` : ''}

        ${state.gameOver ? `
        <div class="glass-card fade-in" style="text-align: center;">
            <h2 style="color: #ef4444; font-size: 2.5rem; margin-bottom: 1rem;">${state.timeUp ? "TIME'S UP!" : "GAME OVER"}</h2>
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">Final Score: <strong>${state.score}</strong></p>
            <p style="font-size: 1.2rem; margin-bottom: 2rem;">Max Streak: <strong>${state.maxStreak}</strong></p>
            <button class="btn" onclick="restartGame()">Play Again</button>
        </div>
        ` : `
        <div class="glass-card fade-in">
            <div class="practice-area">
                <div class="problem-container" id="math-display">
                    <!-- KaTeX renders here -->
                </div>
                
                ${state.mode === 'ruleIdentification' ? `
                ${state.waitingForNext ? `
                <div class="submitted-answer-preview">
                    <span class="preview-label">Your Submitted Answer:</span>
                    <code class="preview-text">${escapeHtml(state.currentInput)}</code>
                </div>
                ` : ''}
                <div class="input-group" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <button class="btn ${state.selectedRule === 'basic' ? 'selected' : ''}" onclick="selectRule('basic')" style="background: ${state.selectedRule === 'basic' ? '#2563eb' : '#1e293b'}; border: 2px solid ${state.selectedRule === 'basic' ? '#3b82f6' : '#334155'};" ${state.waitingForNext ? 'disabled' : ''}>Basic Rules</button>
                    <button class="btn ${state.selectedRule === 'product' ? 'selected' : ''}" onclick="selectRule('product')" style="background: ${state.selectedRule === 'product' ? '#2563eb' : '#1e293b'}; border: 2px solid ${state.selectedRule === 'product' ? '#3b82f6' : '#334155'};" ${state.waitingForNext ? 'disabled' : ''}>Product Rule</button>
                    <button class="btn ${state.selectedRule === 'quotient' ? 'selected' : ''}" onclick="selectRule('quotient')" style="background: ${state.selectedRule === 'quotient' ? '#2563eb' : '#1e293b'}; border: 2px solid ${state.selectedRule === 'quotient' ? '#3b82f6' : '#334155'};" ${state.waitingForNext ? 'disabled' : ''}>Quotient Rule</button>
                    <button class="btn ${state.selectedRule === 'chain' ? 'selected' : ''}" onclick="selectRule('chain')" style="background: ${state.selectedRule === 'chain' ? '#2563eb' : '#1e293b'}; border: 2px solid ${state.selectedRule === 'chain' ? '#3b82f6' : '#334155'};" ${state.waitingForNext ? 'disabled' : ''}>Chain Rule</button>
                </div>
                ` : state.mode === 'quiz' ? `
                ${state.waitingForNext ? `
                <div class="submitted-answer-preview">
                    <span class="preview-label">Your Submitted Answer:</span>
                    <code class="preview-text">${escapeHtml(state.currentInput)}</code>
                </div>
                ` : ''}
                <div class="quiz-options-container">
                    ${state.problem && state.problem.quizData ? state.problem.quizData.options.map(opt => {
                        let isSelected = state.selectedQuizOption === opt.id;
                        let isCorrect = state.waitingForNext && opt.id === state.problem.quizData.correctOptionId;
                        let isWrongSelected = state.waitingForNext && isSelected && !isCorrect;
                        
                        let statusClass = '';
                        if (isCorrect) statusClass = 'correct-opt';
                        else if (isWrongSelected) statusClass = 'wrong-opt';
                        else if (isSelected) statusClass = 'selected-opt';
                        
                        return `
                        <button type="button"
                                class="quiz-option-card ${statusClass}"
                                onclick="selectQuizOption('${opt.id}')"
                                ondblclick="selectQuizOption('${opt.id}'); handleSubmit();"
                                ${state.waitingForNext ? 'disabled' : ''}
                                id="quiz-opt-${opt.id}">
                            <span class="quiz-opt-letter">${opt.id}</span>
                            <div class="quiz-opt-body" id="quiz-opt-content-${opt.id}">
                                ${opt.isNone ? '<span class="none-of-above-text">None of the above</span>' : ''}
                            </div>
                            ${isCorrect ? '<span class="quiz-opt-badge check">✓</span>' : ''}
                            ${isWrongSelected ? '<span class="quiz-opt-badge cross">✗</span>' : ''}
                        </button>
                        `;
                    }).join('') : ''}
                </div>
                ` : `
                <div class="input-group">
                    ${state.waitingForNext ? `
                    <div class="submitted-answer-preview">
                        <span class="preview-label">Your Submitted Answer:</span>
                        <code class="preview-text">${escapeHtml(state.currentInput)}</code>
                    </div>
                    ` : ''}
                    <input type="text"
                           id="answer-input"
                           placeholder="Type derivative (e.g. 2*x + 3)"
                           autocomplete="off"
                           autocapitalize="off"
                           autocorrect="off"
                           spellcheck="false"
                           value="${escapeHtml(state.currentInput || '')}"
                           ${state.waitingForNext ? 'readonly tabindex="-1"' : ''}
                           class="${state.waitingForNext ? 'input-success' : (state.feedbackClass === 'incorrect' ? 'input-error' : '')}" />
                </div>
                `}
                
                <div class="actions">
                    ${!state.waitingForNext ? `
                    <button class="btn" id="submit-btn">Check Answer</button>
                    ${state.mode === 'practice' || state.mode === 'career' || state.mode === 'quiz' ? `
                    <button class="btn" id="skip-btn" style="background: #64748b; margin-left: 0.5rem;">Skip Problem</button>
                    <button class="btn" id="hint-btn" style="background: #eab308; margin-left: 0.5rem;" onclick="showHint()">Hint</button>
                    <button class="btn" id="solution-btn" style="background: #ef4444; margin-left: 0.5rem;" onclick="showSolution()">Show Solution</button>
                    ` : ''}
                    ` : ''}
                    <button class="btn btn-next" id="next-btn" style="display: ${state.waitingForNext ? 'inline-flex' : 'none'}; margin-left: 0.5rem;">
                        Next Problem → <span class="key-hint">[Enter]</span>
                    </button>
                </div>
                
                <div id="feedback-msg" class="feedback ${state.feedbackClass}" aria-live="polite" role="status">${state.feedbackText}</div>

                <div id="steps-container" class="steps-container" style="display: ${state.stepsRevealed > 0 ? 'block' : 'none'};">
                    <h3 style="margin-bottom: 1rem; color: #cbd5e1; text-align: left;">Step-by-Step Guidance:</h3>
                    <ul class="steps-list" style="text-align: left; list-style-position: inside; color: #f8fafc;">
                        ${state.problem ? state.problem.steps.slice(0, state.stepsRevealed).map((step, idx) => {
                            const htmlStep = step.replace(/\$(.*?)\$/g, (match, math) => {
                                return katex.renderToString(math.trim(), { throwOnError: false });
                            });
                            return `<li class="step-item fade-in" style="margin-bottom: 0.8rem; line-height: 1.5;">${htmlStep}</li>`;
                        }).join('') : ''}
                    </ul>
                </div>
            </div>
        </div>
        `}

        <div class="glass-card fade-in">
            <div class="options-panel">
                <div class="options-section">
                    <h3>Game Mode</h3>
                    <div class="radio-group">
                        <label>
                            <input type="radio" name="mode" value="practice" ${state.mode === 'practice' ? 'checked' : ''} onchange="setMode('practice')">
                            Practice (Free Play, Unlocked)
                        </label>
                        <label>
                            <input type="radio" name="mode" value="quiz" ${state.mode === 'quiz' ? 'checked' : ''} onchange="setMode('quiz')">
                            Quiz (Multiple Choice)
                        </label>
                        <label>
                            <input type="radio" name="mode" value="career" ${state.mode === 'career' ? 'checked' : ''} onchange="setMode('career')">
                            Career (Level Up to Unlock)
                        </label>

                        <label>
                            <input type="radio" name="mode" value="timeAttack" ${state.mode === 'timeAttack' ? 'checked' : ''} onchange="setMode('timeAttack')">
                            Time Attack (Race the Clock)
                        </label>
                        <label>
                            <input type="radio" name="mode" value="ruleIdentification" ${state.mode === 'ruleIdentification' ? 'checked' : ''} onchange="setMode('ruleIdentification')">
                            Rule Identification
                        </label>
                    </div>
                </div>
                <div class="options-section">
                    <h3>Rules</h3>
                    <div class="checkbox-group">
                        ${Object.keys(state.rules).map(rule => {
                            let isLocked = false;
                            let reqLvl = 1;
                            if (state.mode === 'career') {
                                if (rule === 'product') reqLvl = 2;
                                if (rule === 'quotient') reqLvl = 4;
                                if (rule === 'chain') reqLvl = 6;
                                isLocked = state.level < reqLvl;
                            }
                            return `
                            <label class="${isLocked ? 'locked' : ''}">
                                <input type="checkbox" id="rule-${rule}" ${state.rules[rule] && !isLocked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} onchange="toggleRule('${rule}')">
                                ${rule === 'basic' ? 'Basic Rules' : rule.charAt(0).toUpperCase() + rule.slice(1) + ' Rule'} ${isLocked ? '(Lvl ' + reqLvl + ')' : ''}
                            </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                ${state.mode === 'practice' ? `
                <div class="options-section">
                    <h3>Practice Timer</h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
                        <input type="number" id="timer-input" min="5" max="300" placeholder="Secs" style="width: 70px; padding: 0.5rem; border-radius: 4px; background: rgba(15, 23, 42, 0.8); color: white; border: 1px solid var(--border-color);">
                        <button class="btn" onclick="startTimer()" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Start</button>
                        ${state.timerActive ? `<button class="btn" onclick="stopTimer()" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #ef4444;">Stop</button>` : ''}
                    </div>
                </div>
                ` : ''}
                <div class="options-section">
                    <h3>Difficulty</h3>
                    <div class="radio-group">
                        ${['easy', 'medium', 'hard', 'very hard'].map(diff => {
                            let isLocked = false;
                            let reqLvl = 1;
                            if (state.mode === 'career') {
                                if (diff === 'medium') reqLvl = 3;
                                if (diff === 'hard') reqLvl = 5;
                                if (diff === 'very hard') reqLvl = 8;
                                isLocked = state.level < reqLvl;
                            }
                            return `
                                <label class="${isLocked ? 'locked' : ''}">
                                    <input type="radio" name="difficulty" value="${diff}" ${state.difficulty === diff ? 'checked' : ''} ${isLocked ? 'disabled' : ''} onchange="setDifficulty('${diff}')">
                                    ${diff.charAt(0).toUpperCase() + diff.slice(1)} ${isLocked ? `(Lvl ${reqLvl})` : ''}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render Math
    if (state.problem && !state.gameOver) {
        const display = document.getElementById('math-display');
        if (display) {
            katex.render(state.problem.tex, display, {
                throwOnError: false,
                displayMode: true
            });
        }

        // Render Quiz Mode Options
        if (state.mode === 'quiz' && state.problem.quizData) {
            state.problem.quizData.options.forEach(opt => {
                if (!opt.isNone) {
                    const optEl = document.getElementById(`quiz-opt-content-${opt.id}`);
                    if (optEl) {
                        try {
                            katex.render(opt.text, optEl, {
                                throwOnError: false,
                                displayMode: true
                            });
                        } catch(e) {
                            optEl.textContent = opt.text;
                        }
                    }
                }
            });

            const mathRevealEl = document.getElementById('quiz-correct-math-reveal');
            if (mathRevealEl) {
                try {
                    katex.render(state.problem.quizData.correctTex, mathRevealEl, {
                        throwOnError: false
                    });
                } catch(e) {
                    mathRevealEl.textContent = state.problem.quizData.correctTex;
                }
            }
        }
    }

    // Event Listeners
    if (!state.gameOver) {
        const subBtn = document.getElementById('submit-btn');
        if (subBtn) subBtn.addEventListener('click', handleSubmit);
        
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) skipBtn.addEventListener('click', nextProblem);
        
        const ansInput = document.getElementById('answer-input');
        if (ansInput) {
            ansInput.addEventListener('input', (e) => {
                state.currentInput = e.target.value;
                if (state.feedbackClass === 'incorrect') {
                    ansInput.classList.remove('input-error');
                }
            });
            ansInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!state.waitingForNext) {
                        handleSubmit();
                    } else if (Date.now() - (state.lastSubmitTime || 0) > 250) {
                        nextProblem();
                    }
                }
            });
            
            // Focus input & select text on incorrect for easy editing (desktop only, new problem or wrong answer)
            const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            if (!state.waitingForNext && !isTouch && (state.focusPending || state.feedbackClass === 'incorrect')) {
                ansInput.focus();
                if (state.feedbackClass === 'incorrect') {
                    ansInput.select();
                }
            }
            state.focusPending = false;
        }
        
        const nxtBtn = document.getElementById('next-btn');
        if (nxtBtn) {
            nxtBtn.addEventListener('click', nextProblem);
            if (state.waitingForNext) {
                setTimeout(() => {
                    const b = document.getElementById('next-btn');
                    if (b) b.focus();
                }, 0);
            }
        }
    }
}

// Actions
window.showHint = function() {
    if (!state.problem) return;
    if (state.stepsRevealed < state.problem.steps.length) {
        state.stepsRevealed++;
        state.streak = 0;
        render();
    }
};

window.showSolution = function() {
    if (!state.problem) return;
    state.stepsRevealed = state.problem.steps.length;
    state.streak = 0;
    render();
};

window.toggleRule = function(rule) {
    if (state.mode === 'career') {
        const ruleReqs = { basic: 1, product: 2, quotient: 4, chain: 6 };
        if (state.level < (ruleReqs[rule] || 1)) return;
    }
    state.rules[rule] = !state.rules[rule];
    if (!Object.values(state.rules).some(v => v)) {
        state.rules[rule] = true;
        alert("At least one rule must be selected!");
        render();
        return;
    }
    if (state.problem && !state.rules[state.problem.rule]) {
        nextProblem();
    } else {
        render();
    }
};

window.selectRule = function(rule) {
    if (state.gameOver || state.waitingForNext) return;
    state.selectedRule = rule;
    render();
};

window.selectQuizOption = function(optId) {
    if (state.gameOver || state.waitingForNext) return;
    state.selectedQuizOption = optId;
    render();
};

window.setDifficulty = function(diff) {
    state.difficulty = diff;
    render();
};

window.setMode = function(mode) {
    if (mode === 'survival') return;
    if (state.mode === 'practice') {
        state.practiceRules = { ...state.rules };
    }
    state.mode = mode;
    if (mode === 'career') {
        const ruleReqs = { basic: 1, product: 2, quotient: 4, chain: 6 };
        for (let r in ruleReqs) {
            if (state.level < ruleReqs[r]) state.rules[r] = false;
        }
        if (!Object.values(state.rules).some(v => v)) state.rules.basic = true;
        
        const diffReqs = { 'very hard': 8, hard: 5, medium: 3, easy: 1 };
        if (state.level < (diffReqs[state.difficulty] || 1)) {
            if (state.level >= 8) state.difficulty = 'very hard';
            else if (state.level >= 5) state.difficulty = 'hard';
            else if (state.level >= 3) state.difficulty = 'medium';
            else state.difficulty = 'easy';
        }
    } else if (mode === 'practice' && state.practiceRules) {
        state.rules = { ...state.practiceRules };
    }
    stopTimer();
    restartGame();
};

function timeAttackTick() {
    if (!state.timerActive || state.mode !== 'timeAttack') return;
    state.timeLeft -= 1;
    
    const timeEl = document.getElementById('timer-display');
    if (timeEl) {
        const m = Math.floor(state.timeLeft / 60);
        const s = state.timeLeft % 60;
        timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    if (state.timeLeft <= 0) {
        clearInterval(timerIntervalId);
        state.timerActive = false;
        state.gameOver = true;
        state.timeUp = true;
        render();
    }
}

window.restartGame = function() {
    state.score = 0;
    state.streak = 0;
    state.gameOver = false;
    state.timeUp = false;
    if (timerIntervalId) clearInterval(timerIntervalId);
    
    if (state.mode === 'timeAttack') {
        state.timeLeft = 120;
        state.timerActive = true;
        timerIntervalId = setInterval(timeAttackTick, 1000);
    } else {
        state.timerActive = false;
    }
    nextProblem();
};

window.startTimer = function() {
    const inputEl = document.getElementById('timer-input');
    if (!inputEl) return;
    let secs = parseInt(inputEl.value, 10);
    if (isNaN(secs) || secs <= 0) return;
    secs = Math.min(300, Math.max(5, secs));
    
    state.timeLeft = secs;
    state.practiceTimeLimit = secs;
    state.timerActive = true;
    state.gameOver = false;
    state.timeUp = false;
    state.score = 0;
    state.streak = 0;
    
    if (timerIntervalId) clearInterval(timerIntervalId);
    timerIntervalId = setInterval(() => {
        if (!state.timerActive) return;
        if (state.waitingForNext && state.mode === 'practice') return;
        state.timeLeft -= 1;
        
        const timeEl = document.getElementById('timer-display');
        if (timeEl) {
            const m = Math.floor(state.timeLeft / 60);
            const s = state.timeLeft % 60;
            timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        }
        
        if (state.timeLeft <= 0) {
            if (state.mode === 'practice') {
                state.timeUp = true;
                state.waitingForNext = true;
                state.feedbackText = "Time's up! Here is the solution.";
                state.feedbackClass = 'incorrect';
                showSolution();
            } else {
                clearInterval(timerIntervalId);
                state.timerActive = false;
                state.gameOver = true;
                state.timeUp = true;
                render();
            }
        }
    }, 1000);
    
    nextProblem();
};

window.stopTimer = function() {
    if (timerIntervalId) clearInterval(timerIntervalId);
    state.timerActive = false;
    state.timeUp = false;
    render();
};

function nextProblem() {
    let newProb = generateProblem();
    let maxRetries = 10;
    while (state.problem && newProb && newProb.expr === state.problem.expr && maxRetries > 0) {
        newProb = generateProblem();
        maxRetries--;
    }
    state.problem = newProb;
    state.feedbackText = '';
    state.feedbackClass = '';
    state.waitingForNext = false;
    state.stepsRevealed = 0;
    state.selectedRule = null;
    state.selectedQuizOption = null;
    state.currentInput = '';
    state.focusPending = true;
    if (state.mode === 'practice' && state.timerActive && state.practiceTimeLimit > 0) {
        state.timeLeft = state.practiceTimeLimit;
        state.timeUp = false;
    }
    render();
}

function handleSubmit() {
    if (!state.problem) return;
    state.lastSubmitTime = Date.now();
    let isCorrect = false;
    let processedInput = "";
    let rawInput = "";
    
    if (state.mode === 'ruleIdentification') {
        if (!state.selectedRule) return;
        const ruleNames = {
            basic: 'Basic Rules',
            product: 'Product Rule',
            quotient: 'Quotient Rule',
            chain: 'Chain Rule'
        };
        rawInput = ruleNames[state.selectedRule] || state.selectedRule;
        state.currentInput = rawInput;
        isCorrect = (state.problem.rules || [state.problem.rule]).includes(state.selectedRule);
    } else if (state.mode === 'quiz') {
        if (!state.selectedQuizOption) {
            state.feedbackText = 'Please select an option (A, B, C, D, or E) first.';
            state.feedbackClass = 'incorrect';
            render();
            return;
        }
        const quizData = state.problem.quizData;
        const chosenOpt = quizData.options.find(o => o.id === state.selectedQuizOption);
        isCorrect = (state.selectedQuizOption === quizData.correctOptionId);
        rawInput = `Option (${chosenOpt.id})${chosenOpt.isNone ? ': None of the above' : ''}`;
        state.currentInput = rawInput;
    } else {
        const inputEl = document.getElementById('answer-input');
        if (!inputEl) return;
        rawInput = inputEl.value;
        if (!rawInput.trim()) return;
        
        state.currentInput = rawInput;
        
        const checkResult = checkEquivalence(rawInput, state.problem.correctExpr, state.problem.varName);
        if (checkResult.error === 'parse_error') {
            state.feedbackText = `<span class="wrong-answer-echo">"${escapeHtml(rawInput)}"</span> could not be parsed. Check your syntax and try again.`;
            state.feedbackClass = 'incorrect';
            render();
            return;
        }
        isCorrect = checkResult.isCorrect;
    }
    
    if (isCorrect) {
        let points = 10 + (state.streak * 5);
        if (state.mode === 'timeAttack') points *= 2; 
        state.score += points;
        state.streak += 1;
        
        // Award XP
        let xpGained = 10;
        if (state.difficulty === 'medium') xpGained = 20;
        if (state.difficulty === 'hard') xpGained = 30;
        if (state.difficulty === 'very hard') xpGained = 50;
        
        state.xp += xpGained;
        
        let levelUpMsg = '';
        while (state.xp >= getXpForLevel(state.level)) {
            state.xp -= getXpForLevel(state.level);
            state.level += 1;
            levelUpMsg = ' • 🎊 LEVEL UP!';
            document.body.classList.add('flash-gold');
            setTimeout(() => document.body.classList.remove('flash-gold'), 600);
        }
        
        if (state.mode === 'timeAttack') {
            let bonus = Math.max(5, 15 - Math.floor(state.streak / 2));
            state.timeLeft += bonus;
        }
        
        saveStats();
        
        let comboMsg = '';
        if (state.streak >= 3) comboMsg = ' • 🔥 COMBO!';
        
        state.waitingForNext = true;
        state.stepsRevealed = state.problem.steps.length;
        
        let quizCorrectDetail = '';
        if (state.mode === 'quiz') {
            const quizData = state.problem.quizData;
            if (quizData.isNoneCorrect) {
                quizCorrectDetail = `<div style="margin-top: 0.6rem; font-size: 1.05rem; color: #a7f3d0;">Option (${quizData.correctOptionId}) is correct! None of the choices matched the true derivative: <span id="quiz-correct-math-reveal"></span></div>`;
            } else {
                quizCorrectDetail = `<div style="margin-top: 0.5rem; font-size: 1.05rem; color: #a7f3d0;">Option (${quizData.correctOptionId}) is correct!</div>`;
            }
        }
        
        state.feedbackText = `
            <div class="feedback-correct-card">
                <div class="feedback-correct-badge">
                    <span class="feedback-icon">🎉</span>
                    <span class="feedback-title">CORRECT!</span>
                </div>
                <div class="feedback-details">
                    <span class="feedback-points">+${points} points</span>
                    ${comboMsg ? `<span class="feedback-combo">${comboMsg}</span>` : ''}
                    ${levelUpMsg ? `<span class="feedback-levelup">${levelUpMsg}</span>` : ''}
                </div>
                ${quizCorrectDetail}
            </div>
        `;
        state.feedbackClass = 'correct';
        render();
        const nb = document.getElementById('next-btn');
        if (nb) nb.focus();
    } else {
        state.streak = 0;
        
        if (state.mode === 'timeAttack') {
            state.timeLeft = Math.max(0, state.timeLeft - 5);
            saveStats();
            document.body.classList.add('flash-red');
            setTimeout(() => document.body.classList.remove('flash-red'), 300);
            
            if (state.timeLeft === 0) {
                clearInterval(timerIntervalId);
                state.timerActive = false;
                state.gameOver = true;
                state.timeUp = true;
                render();
                return;
            }
        }
        
        state.feedbackText = `<span class="wrong-answer-echo">"${escapeHtml(rawInput)}"</span> is incorrect. Try again!`;
        state.feedbackClass = 'incorrect';
        render();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', (e) => {
        // Prevent hotkeys from firing if typing in a non-answer input field
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.id !== 'answer-input') {
            return;
        }
        if (e.key === 'Enter') {
            if (state.waitingForNext && !state.gameOver) {
                if (e.repeat || (Date.now() - (state.lastSubmitTime || 0) < 250)) {
                    e.preventDefault();
                    return;
                }
                e.preventDefault();
                nextProblem();
                return;
            }
            if (state.mode === 'ruleIdentification' && state.selectedRule && !state.waitingForNext && !state.gameOver) {
                e.preventDefault();
                handleSubmit();
                return;
            }
            if (state.mode === 'quiz' && state.selectedQuizOption && !state.waitingForNext && !state.gameOver) {
                e.preventDefault();
                handleSubmit();
                return;
            }
        }
        if (state.mode === 'ruleIdentification' && !state.gameOver && !state.waitingForNext) {
            if (e.key === '1') { window.selectRule('basic'); return; }
            if (e.key === '2') { window.selectRule('product'); return; }
            if (e.key === '3') { window.selectRule('quotient'); return; }
            if (e.key === '4') { window.selectRule('chain'); return; }
        }
        if (state.mode === 'quiz' && !state.gameOver && !state.waitingForNext) {
            const k = e.key.toUpperCase();
            if (k === 'A' || k === '1') { window.selectQuizOption('A'); return; }
            if (k === 'B' || k === '2') { window.selectQuizOption('B'); return; }
            if (k === 'C' || k === '3') { window.selectQuizOption('C'); return; }
            if (k === 'D' || k === '4') { window.selectQuizOption('D'); return; }
            if (k === 'E' || k === '5') { window.selectQuizOption('E'); return; }
        }
    });
    nextProblem();
});
