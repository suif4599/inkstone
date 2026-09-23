export function mdcssPre(source) {
  let markdown = source;
  let __mdcssHasIndent;
  let mappers;
  globalThis.__MDCSS_LINE_SHIFTS__ = [];
  globalThis.__mdcssRecordShift = function(origLine, delta) {
    if (delta) {
      globalThis.__MDCSS_LINE_SHIFTS__.push({
        o: origLine,
        d: delta
      });
    }
  };
  globalThis.__mdcssOrigLine = function(cur) {
    const shifts = globalThis.__MDCSS_LINE_SHIFTS__.slice().sort((a, b) => a.o - b.o);
    let cum = 0;
    for (const s of shifts) {
      if (cur < s.o + cum) {
        return cur - cum;
      }
      cum += s.d;
    }
    return cur - cum;
  };
  __mdcssHasIndent = false;
  if (markdown.trimStart().startsWith('@indent')) {
    markdown = markdown.trimStart().slice('@indent'.length);
    __mdcssHasIndent = true;
  } else if (markdown.trimStart().startsWith('<indent>')) {
    markdown = markdown.trimStart().slice('<indent>'.length);
    __mdcssHasIndent = true;
  }
  if (__mdcssHasIndent) {
    globalThis.__mdcssRecordShift(1, 2);
    markdown = `<div class="has-indent">

${markdown}

</div>

`;
  }
  const __MDCSS_FENCE_TOKEN_PREFIX__ = "@@MDCSS_FENCE_BLOCK_";
  const __MDCSS_FENCE_TOKEN_SUFFIX__ = "@@";
  const __MDCSS_FENCED_BLOCKS__ = [];

  markdown = markdown.replace(
    /(^`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm,
    (match) => {
      const index = __MDCSS_FENCED_BLOCKS__.push(match) - 1;
      return `${__MDCSS_FENCE_TOKEN_PREFIX__}${index}${__MDCSS_FENCE_TOKEN_SUFFIX__}`;
    }
  );
  markdown = markdown.replace(
    /(^|\n)([ \t]{0,3})table<(auto|zebra|nozebra)>:/gi,
    (_match, newline, indentText, mode) => `${newline}${indentText}Table@${mode.toLowerCase()}@:`
  );

  function roman(num, prefix) {
    if (typeof num !== 'number' || num < 1 || num > 3999) {
      return '';
    }
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += symbols[i];
        num -= values[i];
      }
    }
    return result + ") ";
  }

  function romanUpper(num, prefix) {
    return roman(num, prefix).toUpperCase();
  }

  function latin(num, prefix) {
    if (typeof num !== 'number' || num <= 0 || !Number.isInteger(num)) {
      return '';
    }
    let result = '';
    let n = num;
    while (n > 0) {
      n--;
      const remainder = n % 26;
      result = String.fromCharCode(97 + remainder) + result;
      n = Math.floor(n / 26);
    }
    return result + ") ";
  }

  function latinUpper(num, prefix) {
    return latin(num, prefix).toUpperCase();
  }

  function chinese(num, prefix) {
    if (typeof num !== 'number' || num <= 0 || !Number.isInteger(num)) {
      return '';
    }
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const units = ['', '十', '百', '千'];
    const sectionUnits = ['', '万', '亿', '兆'];
    let numStr = num.toString();
    const sections = [];
    while (numStr.length > 4) {
      sections.push(numStr.slice(-4));
      numStr = numStr.slice(0, -4);
    }
    if (numStr.length > 0) sections.push(numStr);
    sections.reverse();

    function convertSection(sectionStr) {
      while (sectionStr.length < 4) sectionStr = '0' + sectionStr;
      let result = '';
      let hasOutput = false;
      let needZero = false;
      for (let i = 0; i < 4; i++) {
        const digit = parseInt(sectionStr[i], 10);
        if (digit !== 0) {
          if (needZero) {
            result += '零';
            needZero = false;
          }
          result += digits[digit] + units[3 - i];
          hasOutput = true;
        } else {
          if (hasOutput) {
            needZero = true;
          }
        }
      }
      return result;
    }
    let chinese = '';
    let lastNonZeroExists = false;
    let needZeroFromPrevZero = false;
    for (let i = 0; i < sections.length; i++) {
      const sectionVal = parseInt(sections[i], 10);
      const sectionChinese = sectionVal === 0 ? '' : convertSection(sections[i]);
      const sectionUnit = sectionUnits[sections.length - 1 - i];
      if (sectionVal === 0) {
        needZeroFromPrevZero = true;
      } else {
        let needPrependZero = false;
        if (needZeroFromPrevZero) {
          needPrependZero = true;
          needZeroFromPrevZero = false;
        } else if (lastNonZeroExists && sectionVal < 1000) {
          needPrependZero = true;
        }
        if (needPrependZero) {
          chinese += '零';
        }
        chinese += sectionChinese + sectionUnit;
        lastNonZeroExists = true;
      }
    }
    if (chinese.startsWith('一十')) {
      chinese = chinese.slice(1);
    }
    return (chinese || '零') + "、";
  }

  function number(num, prefix) {
    if (typeof num !== 'number' || num <= 0 || !Number.isInteger(num)) {
      return '';
    }
    if (/^\d/.test(prefix)) {
      return `${prefix.replace(/\.?\s?$/i, "")}.\u200B${num} `;
    }
    return `${num}\u200B. `;
  }

  function none(num, prefix) {
    return '';
  }

  function preprocessMarkdown(markdown, mappers) {
    let prefix = [null, null, null, null, null, null];
    let counters = [0, 0, 0, 0, 0, 0];
    markdown = markdown.replace(
      /^(#{1,6})\s*?\.(.*?)$/gm,
      (match, hashes, title) => {
        const level = hashes.length - 1;
        counters[level]++;
        for (let i = level + 1; i < 6; i++) {
          counters[i] = 0;
          prefix[i] = null;
        }
        let lastPrefix = "";
        let i = level - 1;
        while (i >= 0) {
          if (prefix[i] === null) {
            i--;
            continue;
          }
          lastPrefix = prefix[i];
          break;
        }
        const newPrefix = mappers[level](
          counters[level],
          lastPrefix
        )
        prefix[level] = newPrefix;
        return `${hashes} ${newPrefix}${title}`;
      }
    )
    return markdown;
  }
  mappers = [none, chinese, number, number, latin, roman];
  markdown = preprocessMarkdown(markdown, mappers);
  const columnRegex = /(^-?\|\|\|-?:?\d*(?:%|px)?:?!?:?$)/m;

  function parseCulumnSpec(spec) {
    let type = "separator";
    let width = "";
    let align = "";
    let main = false;
    if (spec.startsWith("|||-")) {
      type = "start";
      spec = spec.slice(4);
    } else if (spec.startsWith("-|||")) {
      if (spec.length != 4) {
        return null;
      }
      type = "end";
      return {
        type,
        align,
        width,
        main
      };
    } else {
      spec = spec.slice(3);
    }
    if (spec.includes("!")) {
      main = true;
      spec = spec.replace("!", "");
    }
    align = "flex-start";
    if (spec.endsWith(":")) {
      align = "flex-end";
      spec = spec.slice(0, -1);
      if (spec.startsWith(":")) {
        align = "center";
        spec = spec.slice(1);
      }
    } else if (spec.startsWith(":")) {
      spec = spec.slice(1);
    }
    let unit = "%";
    if (spec.endsWith("px")) {
      unit = "px";
      spec = spec.slice(0, -2);
    } else if (spec.endsWith("%")) {
      spec = spec.slice(0, -1);
    }
    if (!/^-?\d+$/.test(spec)) {
      width = "1fr";
    } else {
      const num = parseInt(spec, 10);
      width = isNaN(num) ? `1fr` : `${num}${unit}`;
    }
    return {
      type,
      align,
      width,
      main
    };
  }

  function formatNumber(num) {
    const rounded = Math.round(num * 10000) / 10000;
    return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`.replace(/\.?0+$/, "");
  }

  function normalizeColumnWidths(entries) {
    const percentEntries = [];
    let percentTotal = 0;

    for (const entry of entries) {
      const width = entry.spec.width;
      const percentMatch = width.match(/^(\d+(?:\.\d+)?)%$/);
      if (percentMatch) {
        const value = Number(percentMatch[1]);
        if (Number.isFinite(value) && value > 0) {
          percentEntries.push(entry);
          percentTotal += value;
        }
      }
    }

    if (percentTotal > 100 && percentEntries.length > 0) {
      const scale = 100 / percentTotal;
      for (const entry of percentEntries) {
        const value = Number(entry.spec.width.replace("%", ""));
        entry.spec.width = `${formatNumber(value * scale)}%`;
      }
    }

    return entries;
  }

  function mergeColumnSpec(markdown) {
    let parts = markdown.split(columnRegex);
    let specIndex = {};
    const partLine = [];
    let lineCounter = 1;
    for (const part of parts) {
      partLine.push(lineCounter);
      lineCounter += columnRegex.test(part) ? 0 : (part.match(/\n/g) || []).length;
    }
    const preLedger = globalThis.__MDCSS_LINE_SHIFTS__.slice().sort((a, b) => a.o - b.o);

    function preOrigLine(cur) {
      let cum = 0;
      for (const s of preLedger) {
        if (cur < s.o + cum) {
          return cur - cum;
        }
        cum += s.d;
      }
      return cur - cum;
    }
    const pendingShifts = [];
    for (let i = 0; i < parts.length; i++) {
      if (!columnRegex.test(parts[i])) {
        continue;
      }
      const spec = parseCulumnSpec(parts[i]);
      if (!spec) {
        continue;
      }
      switch (spec.type) {
        case "start":
          if (Object.keys(specIndex).length > 0) {
            specIndex = {};
          }
          specIndex[i] = spec;
          break;
        case "separator":
          if (Object.keys(specIndex).length === 0) {
            break;
          }
          specIndex[i] = spec;
          break;
        case "end":
          if (Object.keys(specIndex).length === 0) {
            break;
          } {
            const orderedSpecs = normalizeColumnWidths(
              Object.keys(specIndex).map((index) => ({
                index,
                spec: specIndex[index]
              }))
            );
            let mainIdx = orderedSpecs.findIndex(({
              spec: s
            }) => s.main);
            if (mainIdx < 0) {
              mainIdx = 0;
            }
            const cols = orderedSpecs.map(({
              spec
            }) => `minmax(auto, ${spec.width})`).join(' ');
            let outerDiv = `

<div style="display: grid; grid-template-columns: ${cols}; gap: 20px; width: 100%; min-width: 0; box-sizing: border-box;" data-mdcss-cols="${cols}">

`;
            for (let c = 0; c < orderedSpecs.length; c++) {
              const {
                index,
                spec: s
              } = orderedSpecs[c];
              const innerDiv = `

<div style="display: flex; flex-direction: column; justify-content: ${s.align}; min-width: 0; max-width: 100%;" data-mdcss-col="${c === mainIdx ? "main" : "side"}" data-mdcss-col-align="${s.align}">

`;
              parts[index] = outerDiv + innerDiv;
              outerDiv = `</div>`;
            }
            parts[i] = `</div></div>`;
            for (const {
                index
              }
              of orderedSpecs) {
              pendingShifts.push({
                line: partLine[index],
                d: (parts[index].match(/\n/g) || []).length + 2
              });
            }
            pendingShifts.push({
              line: partLine[i],
              d: 2
            });
            specIndex = {};
          }
          break;
      }
    }
    for (const s of pendingShifts) {
      globalThis.__mdcssRecordShift(preOrigLine(s.line) + 1, s.d);
    }
    return parts.join("\n");
  }
  markdown = mergeColumnSpec(markdown);
  const __mdcssFenceTokenRestorePattern = /@@MDCSS_FENCE_BLOCK_(\d+)@@/g;
  markdown = markdown.replace(__mdcssFenceTokenRestorePattern, (match, indexText) => {
    const index = Number(indexText);
    if (!Number.isInteger(index) || index < 0 || index >= __MDCSS_FENCED_BLOCKS__.length) {
      return match;
    }
    return __MDCSS_FENCED_BLOCKS__[index];
  });
  return markdown;
}

export function mdcssPost(html) {
  const MDCSS_CONTROL_RE = /^(\d{1,4})(%|px)?(Lf|Rf|r|L|R)?(i|I|m|M)?(?:\((\d{1,3}),(\d{1,3})\))?$/;
  const MDCSS_LAYOUT_CLASS = {
    r: 'mdcss-row',
    L: 'mdcss-left',
    R: 'mdcss-right',
    Lf: 'mdcss-float-left',
    Rf: 'mdcss-float-right',
  };
  const MDCSS_EFFECT_CLASS = {
    i: 'mdcss-inv',
    I: 'mdcss-bright',
    m: 'mdcss-mix',
    M: 'mdcss-matte',
  };

  function parseImageAlt(alt) {
    if (!alt) return null;
    const parts = alt.split('|');
    const control = parts[0].trim();
    let match = null;
    if (control !== '') {
      match = control.match(MDCSS_CONTROL_RE);
      if (!match || Number(match[1]) <= 0) return null;
    }
    let lo = null;
    let hi = null;
    if (match && match[5] !== undefined) {
      const a = Number(match[5]);
      const b = Number(match[6]);
      if (0 <= a && a < b && b <= 255) {
        lo = a;
        hi = b;
      }
    }
    return {
      width: match ? Number(match[1]) : null,
      unit: match ? (match[2] || '%') : null,
      layout: match ? (match[3] || null) : null,
      effect: match ? (match[4] || null) : null,
      effectLo: lo,
      effectHi: hi,
      caption: (parts[1] || '').trim(),
      realAlt: parts.slice(2).join('|').trim(),
    };
  }

  function widthValueOf(parsed) {
    if (parsed.width === null) return null;
    if (parsed.unit === 'px') return `${parsed.width}px`;
    return `${Math.min(parsed.width, 100)}%`;
  }

  function mergeStyle(existingStyle, widthValue, layout) {
    const styleMap = new Map();
    const styleText = existingStyle || '';

    styleText
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const idx = entry.indexOf(':');
        if (idx <= 0) return;
        const key = entry.slice(0, idx).trim().toLowerCase();
        const value = entry.slice(idx + 1).trim();
        if (!key || !value) return;
        styleMap.set(key, value);
      });

    styleMap.set('width', `${widthValue} !important`);
    styleMap.set('height', 'auto !important');

    styleMap.delete('margin');
    styleMap.delete('margin-left');
    styleMap.delete('margin-right');
    styleMap.delete('vertical-align');

    if (layout === 'r') {
      styleMap.set('display', 'inline-block !important');
      styleMap.set('margin', '0 !important');
      styleMap.set('vertical-align', 'middle !important');
    } else if (layout === 'L') {
      styleMap.set('display', 'block !important');
      styleMap.set('margin-left', '0 !important');
      styleMap.set('margin-right', 'auto !important');
    } else if (layout === 'R') {
      styleMap.set('display', 'block !important');
      styleMap.set('margin-left', 'auto !important');
      styleMap.set('margin-right', '0 !important');
    } else if (layout === 'Lf' || layout === 'Rf') {
      styleMap.delete('display');
    } else {
      styleMap.set('display', 'block !important');
      styleMap.set('margin', '0 auto !important');
    }

    return Array.from(styleMap.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }

  function appendAttr(imgTag, attrText) {
    if (imgTag.endsWith('/>')) {
      return `${imgTag.slice(0, -2)} ${attrText}/>`;
    }
    return `${imgTag.slice(0, -1)} ${attrText}>`;
  }

  function mergeClassAttr(imgTag, newClasses) {
    const classMatch = imgTag.match(/\bclass=(['"])(.*?)\1/i);
    if (classMatch) {
      const merged = classMatch[2].split(/\s+/).filter(Boolean);
      newClasses.forEach((c) => {
        if (!merged.includes(c)) merged.push(c);
      });
      return imgTag.replace(classMatch[0], `class="${merged.join(' ')}"`);
    }
    return appendAttr(imgTag, `class="${newClasses.join(' ')}"`);
  }

  html = html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const altMatch = imgTag.match(/\balt=(['"])(.*?)\1/i);
    const alt = altMatch ? altMatch[2] : '';
    const parsed = parseImageAlt(alt);
    if (!parsed) return imgTag;

    const widthValue = widthValueOf(parsed);
    const classes = [];
    if (parsed.layout) classes.push(MDCSS_LAYOUT_CLASS[parsed.layout]);
    if (parsed.effect) {
      if (parsed.effectLo !== null) {
        classes.push(`${MDCSS_EFFECT_CLASS[parsed.effect]}-${parsed.effectLo}-${parsed.effectHi}`);
      } else {
        classes.push(MDCSS_EFFECT_CLASS[parsed.effect]);
      }
    }
    if (widthValue === null && !parsed.caption) return imgTag;

    let tag = imgTag;
    if (widthValue !== null) {
      const styleMatch = tag.match(/\bstyle=(['"])(.*?)\1/i);
      const mergedStyle = mergeStyle(styleMatch ? styleMatch[2] : '', widthValue, parsed.layout);
      if (styleMatch) {
        tag = tag.replace(styleMatch[0], `style="${mergedStyle}"`);
      } else {
        tag = appendAttr(tag, `style="${mergedStyle}"`);
      }
    }
    if (classes.length) {
      tag = mergeClassAttr(tag, classes);
    }

    const outAlt = parsed.realAlt || parsed.caption.replace(/^\./, '') || '';
    if (altMatch) {
      tag = tag.replace(altMatch[0], `alt=${altMatch[1]}${outAlt}${altMatch[1]}`);
    }

    if (parsed.caption) {
      tag = appendAttr(tag, `data-mdcss-cap="${parsed.caption.replace(/"/g, '&quot;')}"`);
    }
    return tag;
  });

  function mergeInlineStyle(tagStart, styleText) {
    const styleMatch = tagStart.match(/style="(.*?)"/i);
    if (styleMatch) {
      const existing = styleMatch[1].trim();
      const merged = existing ? `${existing}; ${styleText}` : styleText;
      return tagStart.replace(styleMatch[0], `style="${merged}"`);
    }
    return `${tagStart} style="${styleText}"`;
  }

  const wrapStyle = 'white-space: normal !important; overflow-wrap: anywhere; word-break: break-word;';
  const cr_regex = /(<td.*?)>(:?c\d+:?|:?r\d+:?|:?c\d+r\d+:?|:?r\d+c\d+:?)\s+(.*)<\/td>/g;
  html = html.replace(cr_regex, (match, tdStart, spanInfo, content) => {
    let colspan = 1;
    let rowspan = 1;
    let align = '';
    const colMatch = spanInfo.match(/c(\d+)/);
    if (colMatch) {
      colspan = parseInt(colMatch[1], 10);
    }
    const rowMatch = spanInfo.match(/r(\d+)/);
    if (rowMatch) {
      rowspan = parseInt(rowMatch[1], 10);
    }
    if (spanInfo.startsWith(':') && spanInfo.endsWith(':')) {
      align = 'center';
    } else if (spanInfo.startsWith(':')) {
      align = 'left';
    } else if (spanInfo.endsWith(':')) {
      align = 'right';
    }
    const alignStyle = align ? `text-align: ${align} !important;` : '';
    tdStart = mergeInlineStyle(tdStart, `${alignStyle} ${wrapStyle}`.trim());
    return `${tdStart} colspan="${colspan}" rowspan="${rowspan}">${content}</td>`;
  });
  const rm_regex = /<td[^>]*>\\<\/td>/g;
  html = html.replace(rm_regex, '');
  const esc_regex = /<td([^>]*)>\\\\<\/td>/g;
  html = html.replace(esc_regex, '<td$1>\\</td>');
  const th_regex = /(<th.*?)>(:?c\d+:?)\s+(.*)<\/th>/g;
  html = html.replace(th_regex, (match, thStart, spanInfo, content) => {
    let colspan = 1;
    let align = '';
    const colMatch = spanInfo.match(/c(\d+)/);
    if (colMatch) {
      colspan = parseInt(colMatch[1], 10);
    }
    if (spanInfo.startsWith(':') && spanInfo.endsWith(':')) {
      align = 'center';
    } else if (spanInfo.startsWith(':')) {
      align = 'left';
    } else if (spanInfo.endsWith(':')) {
      align = 'right';
    }
    const alignStyle = align ? `text-align: ${align} !important;` : '';
    thStart = mergeInlineStyle(thStart, `${alignStyle} ${wrapStyle}`.trim());
    return `${thStart} colspan="${colspan}">${content}</th>`;
  });
  const rm_th_regex = /<th[^>]*>\\<\/th>/g;
  html = html.replace(rm_th_regex, '');
  const esc_th_regex = /<th([^>]*)>\\\\<\/th>/g;
  html = html.replace(esc_th_regex, '<th$1>\\</th>');

  const MDCSS_ZEBRA_TAG_RE = /(<p[^>]*>)\s*Table@(auto|zebra|nozebra)@:\s*(.*?)<\/p>\s*(<div(?![^>]*data-mdcss-col)[^>]*>\s*<table[\s\S]*?<\/table>\s*<\/div>|<table[\s\S]*?<\/table>)/g;

  function zebraMergeClass(attrs, cls) {
    const classMatch = attrs.match(/\sclass="([^"]*)"/);
    if (classMatch) {
      const merged = classMatch[1] ? `${classMatch[1]} ${cls}` : cls;
      return attrs.replace(classMatch[0], ` class="${merged}"`);
    }
    return ` class="${cls}"${attrs}`;
  }

  function zebraApplyBands(tablePart) {
    const tbodyMatch = tablePart.match(/(<tbody[^>]*>)([\s\S]*?)(<\/tbody>)/);
    if (!tbodyMatch) return tablePart;
    const rows = tbodyMatch[2].match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
    if (!rows) return tablePart;
    const parent = [];
    for (let i = 0; i < rows.length; i += 1) parent.push(i);
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    rows.forEach((row, i) => {
      (row.match(/<t[dh][^>]*>/g) || []).forEach((tag) => {
        const spanMatch = tag.match(/rowspan="(\d+)"/);
        if (!spanMatch) return;
        const end = Math.min(i + parseInt(spanMatch[1], 10) - 1, rows.length - 1);
        for (let k = i + 1; k <= end; k += 1) {
          const ra = find(i);
          const rb = find(k);
          if (ra !== rb) {
            if (ra < rb) parent[rb] = ra;
            else parent[ra] = rb;
          }
        }
      });
    });
    const bandOf = new Map();
    const rowBand = [];
    for (let i = 0; i < rows.length; i += 1) {
      const root = find(i);
      if (!bandOf.has(root)) bandOf.set(root, bandOf.size);
      rowBand.push(bandOf.get(root));
    }
    let rowIndex = 0;
    const striped = tbodyMatch[2].replace(/<tr[^>]*>[\s\S]*?<\/tr>/g, (row) => {
      const band = rowBand[rowIndex];
      rowIndex += 1;
      if (band % 2 !== 1) return row;
      return row.replace(/<tr([^>]*)>/, (_t, attrs) => `<tr${zebraMergeClass(attrs, 'mdcss-z')}>`);
    });
    return tablePart.replace(tbodyMatch[0], () => tbodyMatch[1] + striped + tbodyMatch[3]);
  }

  html = html.replace(MDCSS_ZEBRA_TAG_RE, (_match, pOpen, mode, caption, tablePart) => {
    let out = tablePart.replace(/<table([^>]*)>/, (_t, attrs) => `<table${zebraMergeClass(attrs, `mdcss-${mode}`)}>`);
    if (mode === 'auto') out = zebraApplyBands(out);
    return `${pOpen}Table: ${caption}</p>\n${out}`;
  });

  html = html.replace(
    /<table(?![^>]*mdcss-(?:auto|zebra|nozebra))([^>]*)>([\s\S]*?)<\/table>/g,
    (_match, attrs, body) => zebraApplyBands(`<table${zebraMergeClass(attrs, 'mdcss-auto')}>${body}</table>`)
  );

  html = html.replace(
    /<p[^>]*>\s*Table:\s*(.*?)<\/p>\s*(<div(?![^>]*data-mdcss-col)[^>]*>\s*<table[\s\S]*?<\/table>\s*<\/div>|<table[\s\S]*?<\/table>)/gi,
    (_match, caption, tableHtml) => {
      caption = caption.trim();
      if (!caption) return _match;
      const prefix = caption.startsWith('.') ? '表@TABLE_COUNT_PLACEHOLDER@:\t' : '';
      const displayCaption = caption.startsWith('.') ? caption.slice(1) : caption;
      return `<figure style="width: fit-content; max-width: 100%; margin: 0 auto;">
<figcaption style="text-align: center; overflow-wrap: break-word;">${prefix}${displayCaption}</figcaption>
${tableHtml}
</figure>`;
    }
  );

  let tableCnt = 0;
  html = html.replace(/@TABLE_COUNT_PLACEHOLDER@/g, () => {
    tableCnt += 1;
    return tableCnt;
  });

  function hasMdcssClass(tag, cls) {
    const m = tag.match(/\bclass=(['"])(.*?)\1/i);
    return m ? m[2].split(/\s+/).includes(cls) : false;
  }

  function rewriteImgStyle(imgTag, style) {
    const styleMatch = imgTag.match(/style=(['"])(.*?)\1/i);
    if (styleMatch) {
      return imgTag.replace(styleMatch[0], `style="${style}"`);
    }
    if (imgTag.endsWith('/>')) {
      return `${imgTag.slice(0, -2)} style="${style}"/>`;
    }
    return `${imgTag.slice(0, -1)} style="${style}">`;
  }

  html = html.replace(
    /<img[^\>]*>/g,
    (imgTag) => {
      const capMatch = imgTag.match(/\bdata-mdcss-cap="([^"]*)"/i);
      const caption = capMatch ? capMatch[1] : '';
      const isRow = hasMdcssClass(imgTag, 'mdcss-row');
      if (!caption && !isRow) return imgTag;
      imgTag = imgTag.replace(/\s+data-mdcss-cap="[^"]*"/, '');

      const isFloat = hasMdcssClass(imgTag, 'mdcss-float-left') || hasMdcssClass(imgTag, 'mdcss-float-right');
      const isSideAligned = !isFloat && (hasMdcssClass(imgTag, 'mdcss-left') || hasMdcssClass(imgTag, 'mdcss-right'));
      const finalCaption = caption.startsWith('.') ? `图@COUNT_PLACEHOLDER@:\t` + caption.slice(1) : caption;
      if (!isRow) {
        if (isFloat) {
          let match = imgTag.match(/style=(['"])(.*?)\1/i);
          let style = match ? match[2] : '';
          style = style.replace(/float:\s*(left|right)\s*!?important?/gi, '');
          style = style.replace(/display:\s*inline-block/g, 'display: block');
          match = style.match(/width:\s*(\d{1,4}(?:px|%))/i);
          const width = match ? match[1] : '100%';
          style = style.replace(/width:\s*\d{1,4}(?:px|%)/g, `width: 100%`);
          if (!/display\s*:/i.test(style)) {
            style = `${style}; display: block`;
          }
          style = style
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
            .join('; ');
          imgTag = rewriteImgStyle(imgTag, style);
          const floatDir = hasMdcssClass(imgTag, 'mdcss-float-right') ? 'right' : 'left';
          const margin = floatDir === 'left' ? '0 1em 1em 0' : '0 0 1em 1em';
          return `<figure class="mdcss-fig mdcss-fig-float-${floatDir}" style="float: ${floatDir}; width: ${width}; margin: ${margin};">
${imgTag}
<figcaption style="text-align: center; overflow-wrap: break-word;">${finalCaption}</figcaption>
</figure>`;
        }

        if (isSideAligned) {
          let match = imgTag.match(/style=(['"])(.*?)\1/i);
          let style = match ? match[2] : '';
          style = style.replace(/display:\s*inline-block/g, 'display: block');
          match = style.match(/width:\s*(\d{1,4}(?:px|%))/i);
          const width = match ? match[1] : '100%';
          style = style.replace(/width:\s*\d{1,4}(?:px|%)/g, `width: 100%`);
          style = style
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
            .join('; ');
          imgTag = rewriteImgStyle(imgTag, style);

          const margin = hasMdcssClass(imgTag, 'mdcss-right') ? '0 0 1em auto' : '0 auto 1em 0';
          return `<figure class="mdcss-fig" style="width: ${width}; margin: ${margin};">
${imgTag}
<figcaption style="text-align: center; overflow-wrap: break-word;">${finalCaption}</figcaption>
</figure>`;
        }

        return `<figure class="mdcss-fig" style="width: 100%; margin: 0 auto; text-align: center;">
${imgTag}
<figcaption style="text-align: center; overflow-wrap: break-word;">${finalCaption}</figcaption>
</figure>`;
      }
      let match = imgTag.match(/style=(['"])(.*?)\1/i);
      let style = match ? match[2] : '';
      style = style.replace(/display:\s*inline-block/g, 'display: block');
      match = style.match(/width:\s*(\d{1,4}(?:px|%))/i);
      const width = match ? match[1] : '100%';
      style = style.replace(/width:\s*\d{1,4}(?:px|%)/g, `width: 100%`);
      imgTag = rewriteImgStyle(imgTag, style);
      const subCaption = caption.startsWith('.') ? `@SUBFIGURE_PLACEHOLDER@\t` + caption.slice(1) : caption;
      return `<figure class="mdcss-fig mdcss-fig-row" style="width: ${width}; margin: 0; display: inline-block; vertical-align: top;">
${imgTag}
    ${subCaption ? `<figcaption style="text-align: center; overflow-wrap: break-word;">${subCaption}</figcaption>` : ''}
</figure>`;
    }
  )

  function subLabel(n) {
    let label = '';
    n += 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      label = String.fromCharCode(97 + rem) + label;
      n = Math.floor((n - 1) / 26);
    }
    return label;
  }

  html = html.replace(
    /((<figure\b[^>]*\bclass=(?:"[^"]*mdcss-fig-row[^"]*"|'[^']*mdcss-fig-row[^']*')[^>]*>[\s\S]*?<\/figure>\s*)+)/g,
    (match) => {
      let firstFigure = match.split('</figure>')[0];
      let captionMatch = firstFigure.match(/<figcaption.*?>(.*?)<\/figcaption>/i);
      let caption = captionMatch ? captionMatch[1] : '';
      let generalCaptionMatch = caption.match(/\((.+)\)/i);
      let generalCaption = generalCaptionMatch ? generalCaptionMatch[1] : '';
      if (generalCaption) {
        let modifiedCaption = caption.replace(/\((.+)\)/i, "");
        let modifiedCaptionTag = captionMatch[0].replace(caption, modifiedCaption);
        let modifiedFirstFigure = firstFigure.replace(captionMatch[0], modifiedCaptionTag);
        match = match.replace(firstFigure, modifiedFirstFigure);
        generalCaption = generalCaption.startsWith('.') ? `图@COUNT_PLACEHOLDER@:\t` + generalCaption.slice(1) : generalCaption;
        generalCaption = `<figcaption style="text-align: center; overflow-wrap: break-word;">${generalCaption}</figcaption>`;
      }
      let subIdx = 0;
      match = match.replace(/@SUBFIGURE_PLACEHOLDER@/g, () => `(${subLabel(subIdx++)})`);
      return `<figure class="mdcss-fig-group" style="text-align: center; width: 100%; margin: 0 auto;">
${match}
${generalCaption || ''}
</figure>`;
    }
  )

  html = html.replace(
    /(?:<p>\s*<\/p>\s*)?(<figure\b[^>]*\bclass=(['"])[^'"]*mdcss-fig-float-(?:left|right)[^'"]*\2[^>]*>[\s\S]*?<\/figure>)\s*(?:<p>\s*<\/p>\s*)?<p>([\s\S]*?)<\/p>/g,
    (match, figureHtml, _q, nextParagraphContent) => `<p>${figureHtml}${nextParagraphContent}</p>`
  )

  let cnt = 0;
  html = html.replace(/@COUNT_PLACEHOLDER@/g, (match) => {
    cnt += 1;
    return cnt;
  });
  html = html.replace(
    /<div data-mdcss-cols="([^"]*)">/g,
    (match, cols) =>
    `<div style="display: grid; grid-template-columns: ${cols}; gap: 20px; width: 100%; min-width: 0; box-sizing: border-box;" data-mdcss-cols="${cols}">`
  );
  html = html.replace(
    /<div data-mdcss-col="(main|side)"(?: data-mdcss-col-align="([^"]*)")?>/g,
    (match, role, align) =>
    `<div style="display: flex; flex-direction: column; justify-content: ${align || "flex-start"}; min-width: 0; max-width: 100%;" data-mdcss-col="${role}"${align ? ` data-mdcss-col-align="${align}"` : ""}>`
  );
  if (globalThis.__MDCSS_LINE_SHIFTS__ && globalThis.__MDCSS_LINE_SHIFTS__.length && typeof globalThis.__mdcssOrigLine === "function") {
    html = html.replace(/data-line="(\d+)"/g, (match, line) => `data-line="${globalThis.__mdcssOrigLine(parseInt(line, 10))}"`);
  }
  return html;
}
