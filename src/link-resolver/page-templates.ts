function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function generateUSCasePage(data: {
    caseName: string;
    citation: string;
    court: string;
    dateFiled: string;
    opinion: string;
    sourceUrl: string;
    source: string;
}): string {
    const opinionText =
        data.opinion.length > 15000
            ? data.opinion.slice(0, 15000) +
              "\n\n*[Opinion truncated. See full text at source link.]*"
            : data.opinion;

    return `---
tags:
  - law/case
  - law/us-case
date: ${today()}
generated-by: law-note-restructurer
source: ${data.source}
source-url: "${data.sourceUrl}"
---

# ${data.caseName}

> [!info] Citation
> ${data.citation || "N/A"}

**Court**: ${data.court || "N/A"}
**Date**: ${data.dateFiled || "N/A"}

## Opinion

${opinionText || "*No opinion text available.*"}

## External Links

- [Full opinion](${data.sourceUrl})

## Related Concepts

*Links will be populated as you study this case.*
`;
}

export function generateUSStatutePage(data: {
    fullCitation: string;
    text: string;
    sourceUrl: string;
}): string {
    const statuteText =
        data.text.length > 20000
            ? data.text.slice(0, 20000) +
              "\n\n*[Text truncated. See full text at source link.]*"
            : data.text;

    return `---
tags:
  - law/statute
  - law/us-statute
date: ${today()}
generated-by: law-note-restructurer
source: cornell-lii
source-url: "${data.sourceUrl}"
---

# ${data.fullCitation}

## Statutory Text

${statuteText || "*No text available.*"}

## External Links

- [Full text on Cornell LII](${data.sourceUrl})

## Notes

*Add your study notes here.*
`;
}

export function generateCNLawPage(data: {
    lawName: string;
    publishDate: string;
    status: string;
    bodyPreview: string;
    sourceUrl: string;
}): string {
    const preview =
        data.bodyPreview.length > 5000
            ? data.bodyPreview.slice(0, 5000) +
              "\n\n*[条文已截断。请访问国家法律法规数据库查看全文。]*"
            : data.bodyPreview;

    return `---
tags:
  - law/statute
  - law/cn-law
date: ${today()}
generated-by: law-note-restructurer
source: flk-npc
source-url: "${data.sourceUrl}"
---

# ${data.lawName}

**发布日期**: ${data.publishDate || "N/A"}
**状态**: ${data.status || "N/A"}

## 条文节选

${preview || "*暂无条文内容。*"}

## 外部链接

- [在国家法律法规数据库查看全文](${data.sourceUrl})

## 学习笔记

*在此添加学习笔记。*
`;
}

export function generateUSCaseStubPage(data: {
    caseName: string;
    searchLinks: { label: string; url: string }[];
}): string {
    const linkLines = data.searchLinks
        .map((l) => `- [${l.label}](${l.url})`)
        .join("\n");

    return `---
tags:
  - law/case
  - law/us-case
date: ${today()}
generated-by: law-note-restructurer
source: stub
---

# ${data.caseName}

> [!warning] Auto-fetch unavailable
> This case could not be automatically retrieved. Use the search links below to find the full opinion, then paste key details here.

## Search Links

${linkLines}

## Case Facts

*To be filled in*

## Holding

*To be filled in*

## Significance

*To be filled in*

## Related Concepts

*Links will be populated as you study this case.*
`;
}

export function generateCNCaseStubPage(data: {
    caseIdentifier: string;
}): string {
    return `---
tags:
  - law/case
  - law/cn-case
date: ${today()}
generated-by: law-note-restructurer
---

# ${data.caseIdentifier}

> [!warning] 自动获取不可用
> 中国裁判文书网有反爬虫保护，无法自动获取案例内容。请手动查找并填写以下信息。

## 查找链接

- [裁判文书网](https://wenshu.court.gov.cn/)
- [北大法宝](https://www.pkulaw.com/)

## 案件事实

*待填写*

## 裁判要旨

*待填写*

## 裁判意义

*待填写*
`;
}
